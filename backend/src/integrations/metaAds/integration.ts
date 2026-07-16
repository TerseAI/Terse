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
import { fetchMetaAdsAdAccounts, metaGraphRequest } from "../../outputs/metaAds/tools/metaAdsGraph"
import { SecretNotFoundError } from "../../services/SecretService"
import { urls } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { FetchResourcesOptions } from "../abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

const META_OAUTH_DIALOG_URL = "https://www.facebook.com/v23.0/dialog/oauth"
const META_OAUTH_SCOPES = "ads_read,ads_management,business_management"

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
            select: { id: true }
        })
        return Promise.all(integrations.map(i => this.buildInstance(i.id)))
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
        const integrations = await db().meta_ads_integrations.findMany({ select: { id: true } })
        return Promise.all(integrations.map(i => this.buildInstance(i.id)))
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
        authUrl.searchParams.append("response_type", "code")
        authUrl.searchParams.append("scope", META_OAUTH_SCOPES)
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

            const accessToken = await this.exchangeCodeForLongLivedToken(code)
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

    async refreshToken(_integrationId: string): Promise<boolean> {
        // Long-lived Meta user tokens (~60 days) cannot be refreshed server-side; users reconnect when they expire.
        return false
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

    private async buildInstance(integrationId: string): Promise<MetaAdsIntegration> {
        const secrets = await this.secretService.tryGetSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.META_ADS, recordId: integrationId }
        })
        return {
            id: integrationId,
            accountName: secrets ? await this.fetchAccountName(secrets.accessToken) : undefined
        }
    }

    private async fetchAccountName(accessToken: string): Promise<string | undefined> {
        try {
            const me = await metaGraphRequest(accessToken, "/me?fields=name", metaUserSchema, "user profile")
            return me.name
        } catch (fetchError) {
            logger.warn("Failed to fetch Meta user profile", { error: fetchError })
            return undefined
        }
    }

    private async exchangeCodeForLongLivedToken(code: string): Promise<string> {
        const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token")
        tokenUrl.searchParams.append("client_id", this.config.clientId)
        tokenUrl.searchParams.append("client_secret", this.config.clientSecret)
        tokenUrl.searchParams.append("redirect_uri", this.config.redirectUri)
        tokenUrl.searchParams.append("code", code)
        const shortLived = await this.fetchAccessToken(tokenUrl, "code exchange")

        const exchangeUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token")
        exchangeUrl.searchParams.append("grant_type", "fb_exchange_token")
        exchangeUrl.searchParams.append("client_id", this.config.clientId)
        exchangeUrl.searchParams.append("client_secret", this.config.clientSecret)
        exchangeUrl.searchParams.append("fb_exchange_token", shortLived)
        return this.fetchAccessToken(exchangeUrl, "long-lived token exchange")
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
        return integration.id
    }
}

const oauthStateSchema = z.object({
    userId: z.string(),
    organizationId: z.string()
})

const metaTokenResponseSchema = z.object({
    access_token: z.string()
})

const metaUserSchema = z.object({
    name: z.string()
})
