import { Request, Response } from "express"
import { ConfigurationFieldDefinition } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationType, MetaAdsAdAccount, MetaAdsIntegration, MetaAdsIntegrationMetadata } from "terse-types/Integrations"
import { OAuthInstallationDetails } from "terse-types/types"
import { z } from "zod"

import { trackIntegrationAdded } from "../../common/analytics"
import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { mintOAuthState, verifyOAuthState } from "../../modules/auth/helpers/oauth"
import { SecretNotFoundError } from "../../services/SecretService"
import { urls } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FetchResourcesOptions } from "../abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

import { MetaAdsAuthError, fetchMetaAdsAdAccounts, fetchMetaAdsConnectionName } from "./apiClient"

const META_GRAPH_VERSION = "v24.0"
const META_OAUTH_DIALOG_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`
const META_DEBUG_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token`

export class MetaAdsIntegrationManager
    extends Integration<MetaAdsIntegration, never, typeof MetaAdsIntegrationMetadata, MetaAdsAdAccount>
    implements OAuthIntegrationInstallation<IntegrationType.META_ADS>
{
    readonly integrationType = IntegrationType.META_ADS
    readonly settingsKey = "metaAds"
    readonly secretSchema = z.object({
        accessToken: z.string()
    })

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<MetaAdsIntegration[]> {
        const integrations = await db().meta_ads_integrations.findMany({
            where: { organization_id: organizationId },
            select: META_ADS_INSTANCE_SELECT
        })
        return integrations.map(toInstance)
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [integration] = await this.getInstancesForOrganization(organizationId)
        if (!integration) {
            return createNotConnectedCliDisplayState()
        }
        return createConnectedCliDisplayState("Account", this.getConnectionName(integration), integration.id)
    }

    getConnectionName(instance: MetaAdsIntegration): string {
        return instance.accountName || instance.id
    }

    formatIntegrationInstanceForAgent(instance: MetaAdsIntegration): string {
        const detail = instance.accountName ? ` (account "${instance.accountName}")` : ""
        return `Meta Ads${detail} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<MetaAdsIntegration[]> {
        const integrations = await db().meta_ads_integrations.findMany({ select: META_ADS_INSTANCE_SELECT })
        return integrations.map(toInstance)
    }

    async getInstance(integrationId: string, organizationId: string): Promise<MetaAdsIntegration | null> {
        const integration = await db().meta_ads_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId },
            select: META_ADS_INSTANCE_SELECT
        })
        return integration ? toInstance(integration) : null
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<MetaAdsIntegration, MetaAdsAdAccount>[]> {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const normalizedQuery = query?.trim().toLowerCase()
        return Promise.all(
            integrations.map(async integration => {
                try {
                    const accessToken = await this.getAccessToken(integration.id)
                    if (!accessToken) {
                        logger.warn("No access token for Meta Ads integration", { integrationId: integration.id })
                        return { integration, resources: [] }
                    }
                    const adAccounts = await fetchMetaAdsAdAccounts(accessToken)
                    const resources = adAccounts
                        .map(
                            (account): MetaAdsAdAccount => ({
                                id: account.id,
                                accountId: account.account_id,
                                name: account.name,
                                currency: account.currency,
                                accountStatus: account.account_status
                            })
                        )
                        .filter(account => !normalizedQuery || account.name.toLowerCase().includes(normalizedQuery) || account.accountId.includes(normalizedQuery))
                    return { integration, resources }
                } catch (error) {
                    logger.warn("Failed to fetch ad accounts for Meta Ads integration", { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    async processWebhookEvent(_event: never): Promise<void> {}
    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}
    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        _options: InstallationOptionsFor<IntegrationType.META_ADS>,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        const state = mintOAuthState(req, res, {
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const authUrl = new URL(META_OAUTH_DIALOG_URL)
        authUrl.searchParams.append("client_id", this.config.clientId)
        authUrl.searchParams.append("redirect_uri", this.config.redirectUri)
        authUrl.searchParams.append("config_id", this.config.configId)
        authUrl.searchParams.append("response_type", "code")
        // Required alongside response_type when a config_id is present, or Meta serves its
        // configured default type instead and hands back a token where we expect a code.
        authUrl.searchParams.append("override_default_response_type", "true")
        authUrl.searchParams.append("state", state)

        return { oauthUrl: authUrl.toString() }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Meta Ads OAuth error", { error: String(error) })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        if (typeof code !== "string" || typeof state !== "string") {
            res.status(400).json({ error: "Missing code or state parameter" })
            return
        }

        try {
            const decoded = oauthStateSchema.safeParse(verifyOAuthState(req, res, state))
            if (!decoded.success) {
                logger.error("Meta Ads OAuth: invalid state payload")
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const accessToken = await this.exchangeCodeForSystemUserToken(code)
            const integrationId = await this.persistInstallation(decoded.data.userId, decoded.data.organizationId, accessToken)

            logger.info("Meta Ads OAuth completed for user", { userId: decoded.data.userId, integrationId })
            trackIntegrationAdded(decoded.data.userId, { integrationType: IntegrationType.META_ADS })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (callbackError) {
            logger.error("Error in Meta Ads OAuth callback", { error: callbackError })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().meta_ads_integrations.delete({ where: { id: integrationId } })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.META_ADS, recordId: integrationId } })
    }

    /**
     * System user tokens have no expiry to extend, so the only thing worth doing on the
     * maintenance pass is asking Meta whether the token still works. A client revoking our
     * app in Business settings is the one way it dies, and that has to be visible.
     */
    async refreshToken(integrationId: string): Promise<boolean> {
        const accessToken = await this.getAccessToken(integrationId)
        if (!accessToken) {
            throw new MetaAdsAuthError(`Meta Ads integration ${integrationId} has no stored access token`)
        }

        const status = await this.inspectToken(accessToken)
        if (!status.isValid) {
            throw new MetaAdsAuthError(`Meta Ads token for integration ${integrationId} is no longer valid: ${status.error ?? "revoked or expired"}`)
        }

        if (status.expiresAt !== null) {
            logger.warn("Meta Ads token has an expiry, so the configuration is not issuing system user tokens", { integrationId, expiresAt: status.expiresAt })
        }
        return true
    }

    private async inspectToken(accessToken: string): Promise<MetaAdsTokenStatus> {
        const url = new URL(META_DEBUG_TOKEN_URL)
        url.searchParams.append("input_token", accessToken)
        url.searchParams.append("access_token", `${this.config.clientId}|${this.config.clientSecret}`)

        const response = await fetch(url)
        const payload: unknown = await response.json()
        const parsed = debugTokenResponseSchema.safeParse(payload)
        if (!parsed.success) {
            throw new MetaAdsAuthError(`Meta Ads token inspection returned an unexpected payload (status ${response.status})`)
        }

        const { is_valid, expires_at, error } = parsed.data.data
        return {
            isValid: is_valid,
            // Meta reports a never-expiring token as 0 rather than omitting the field.
            expiresAt: expires_at && expires_at > 0 ? new Date(expires_at * 1000) : null,
            error: error?.message ?? null
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        const integration = await db().meta_ads_integrations.findUnique({
            where: { id: integrationId },
            select: { id: true }
        })
        if (!integration) {
            logger.error("Meta Ads integration not found", { integrationId })
            return null
        }

        try {
            const secrets = await this.secretService.getSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.META_ADS, recordId: integrationId }
            })
            return secrets.accessToken
        } catch (secretError) {
            if (secretError instanceof SecretNotFoundError) {
                logger.warn("Meta Ads integration is missing its secret blob", { integrationId })
                return null
            }
            throw secretError
        }
    }

    /**
     * The configuration issues a business integration system user token, which defaults to
     * never expiring, so there is no short-lived hop to trade up from.
     */
    private async exchangeCodeForSystemUserToken(code: string): Promise<string> {
        const tokenUrl = new URL(META_TOKEN_URL)
        tokenUrl.searchParams.append("client_id", this.config.clientId)
        tokenUrl.searchParams.append("client_secret", this.config.clientSecret)
        tokenUrl.searchParams.append("redirect_uri", this.config.redirectUri)
        tokenUrl.searchParams.append("code", code)
        return this.fetchAccessToken(tokenUrl, "code exchange")
    }

    private async fetchAccessToken(url: URL, what: string): Promise<string> {
        const response = await fetch(url)
        const payload: unknown = await response.json()
        if (!response.ok) {
            logger.error(`Meta Ads ${what} failed`, { status: response.status })
            throw new Error(`Meta Ads ${what} failed with status ${response.status}`)
        }
        const parsed = metaTokenResponseSchema.safeParse(payload)
        if (!parsed.success) {
            throw new Error(`Meta Ads ${what} returned an unexpected payload`)
        }
        return parsed.data.access_token
    }

    private async persistInstallation(userId: string, organizationId: string, accessToken: string): Promise<string> {
        const existing = await db().meta_ads_integrations.findFirst({ where: { organization_id: organizationId } })
        const integration = existing ?? (await db().meta_ads_integrations.create({ data: { user_id: userId, organization_id: organizationId } }))
        await this.secretService.createSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.META_ADS, recordId: integration.id, value: { accessToken } }
        })
        await db().meta_ads_integrations.update({
            where: { id: integration.id },
            data: { account_name: await fetchAccountName(accessToken) }
        })
        return integration.id
    }
}

const META_ADS_INSTANCE_SELECT = { id: true, account_name: true } as const

function toInstance(row: { id: string; account_name: string | null }): MetaAdsIntegration {
    return {
        id: row.id,
        accountName: row.account_name ?? undefined
    }
}

async function fetchAccountName(accessToken: string): Promise<string | null> {
    try {
        return await fetchMetaAdsConnectionName(accessToken)
    } catch (fetchError) {
        logger.warn("Failed to name the Meta Ads connection", { error: fetchError })
        return null
    }
}

const oauthStateSchema = z.object({
    userId: z.string(),
    organizationId: z.string()
})

const metaTokenResponseSchema = z.object({
    access_token: z.string()
})

const debugTokenResponseSchema = z.object({
    data: z.object({
        is_valid: z.boolean(),
        expires_at: z.number().optional(),
        error: z.object({ message: z.string() }).optional()
    })
})

interface MetaAdsTokenStatus {
    isValid: boolean
    expiresAt: Date | null
    error: string | null
}
