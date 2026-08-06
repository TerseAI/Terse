import { Request, Response } from "express"
import { OAuth2Client } from "google-auth-library"
import { ConfigurationFieldDefinition, FrontendRoutes, OAuthInstallationDetails } from "terse-types"
import { AdditionalStateParams, GoogleSearchConsoleIntegration, GoogleSearchConsoleIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "terse-types/Integrations"
import z from "zod"

import { trackIntegrationAdded } from "../../common/analytics"
import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { mintOAuthState, verifyOAuthState } from "../../modules/auth/helpers/oauth"
import { SecretService } from "../../services/SecretService"
import { urls } from "../../settings"
import { AgentTriggerWithConfigs, GoogleSearchConsoleIntegration as PrismaGoogleSearchConsoleIntegration } from "../../types/prisma"
import { Integration, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"

const SCOPES = ["https://www.googleapis.com/auth/webmasters", "openid", "email"]
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export class GoogleSearchConsoleIntegrationManager
    extends Integration<GoogleSearchConsoleIntegration, never, typeof GoogleSearchConsoleIntegrationMetadata, never>
    implements OAuthIntegrationInstallation<IntegrationType.GOOGLE_SEARCH_CONSOLE>
{
    readonly integrationType = IntegrationType.GOOGLE_SEARCH_CONSOLE
    readonly settingsKey = "googleSearchConsole"
    readonly secretSchema = z.object({
        accessToken: z.string(),
        refreshToken: z.string()
    })

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<GoogleSearchConsoleIntegration[]> {
        const integrations = await db().google_search_console_integrations.findMany({
            where: { organization_id: organizationId }
        })
        return integrations.map(i => ({
            id: i.id,
            email: i.email,
            googleAccountId: i.google_account_id
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [instance] = await this.getInstancesForOrganization(organizationId)
        if (!instance) {
            return createNotConnectedCliDisplayState()
        }
        return createConnectedCliDisplayState("Account", instance.email, instance.id)
    }

    getConnectionName(instance: GoogleSearchConsoleIntegration): string {
        return instance.email
    }

    formatIntegrationInstanceForAgent(instance: GoogleSearchConsoleIntegration): string {
        return `Google Search Console: ${instance.email}`
    }

    async getAllActiveInstances(): Promise<GoogleSearchConsoleIntegration[]> {
        const integrations = await db().google_search_console_integrations.findMany({
            where: { is_active: true }
        })
        return integrations.map(i => ({
            id: i.id,
            email: i.email,
            googleAccountId: i.google_account_id
        }))
    }

    async processWebhookEvent(event: never): Promise<void> {
        throw new Error("Google Search Console webhooks are not processed through this integration manager")
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        await this.revokeAuthorization(integrationId)

        await db().google_search_console_integrations.delete({
            where: { id: integrationId }
        })

        await this.secretService.deleteSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, recordId: integrationId }
        })
    }

    private async revokeAuthorization(integrationId: string): Promise<void> {
        const secrets = await this.secretService.tryGetSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, recordId: integrationId }
        })
        if (!secrets) return

        try {
            await getSearchConsoleOAuth2Client().revokeToken(secrets.refreshToken)
            logger.info("Revoked Google Search Console OAuth token", { integrationId })
        } catch (error) {
            logger.warn("Failed to revoke Google Search Console OAuth token on disconnect", { error, integrationId })
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<IntegrationType.GOOGLE_SEARCH_CONSOLE>,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        const oauth2Client = getSearchConsoleOAuth2Client()

        const state = mintOAuthState(req, res, {
            userId,
            organizationId,
            additionalStatePayload
        })

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline", // Get refresh token
            scope: SCOPES,
            state: state,
            prompt: "consent" // Force consent screen to get refresh token
        })
        return {
            oauthUrl: authUrl
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state } = req.query as { code?: string; state?: string }

        logger.debug("Google Search Console OAuth callback received")

        if (!code || !state) {
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        try {
            const stateData = verifyOAuthState(req, res, state)
            const userId = stateData.userId
            const organizationId = stateData.organizationId

            if (!userId) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            if (!organizationId || typeof organizationId !== "string") {
                logger.error("Google Search Console OAuth: organizationId is required in state", {
                    userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const oauth2Client = getSearchConsoleOAuth2Client()

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code)
            oauth2Client.setCredentials(tokens)
            if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const ticket = await oauth2Client.verifyIdToken({
                idToken: tokens.id_token,
                audience: this.config.clientId
            })
            const identity = ticket.getPayload()
            if (!identity) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const googleAccountId = identity.sub
            const email = identity.email
            if (!googleAccountId || !email) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const integration = await db().google_search_console_integrations.upsert({
                where: {
                    organization_id_google_account_id: {
                        organization_id: organizationId,
                        google_account_id: googleAccountId
                    }
                },
                create: {
                    user_id: userId,
                    organization_id: organizationId,
                    google_account_id: googleAccountId,
                    email: email,
                    is_active: true
                },
                update: {
                    user_id: userId,
                    organization_id: organizationId,
                    google_account_id: googleAccountId,
                    email: email,
                    is_active: true
                }
            })

            await this.secretService.createSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, recordId: integration.id, value: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token } }
            })

            logger.info(`Google Search Console integration activated for ${googleAccountId}`, {
                googleAccountId,
                organizationId
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            trackIntegrationAdded(userId, { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE })

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Google Search Console OAuth error", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Google Search Console doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Google Search Console doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().google_search_console_integrations.findUnique({
                where: { id: integrationId }
            })
            if (!integration || !integration.is_active) {
                logger.warn(`Google Search Console integration ${integrationId} not found or inactive`, { integrationId })
                return false
            }
            const tokenInfo = await refreshAccessTokenIfNeeded(integration)
            return tokenInfo.isRefreshed
        } catch (error) {
            logger.error(`Error refreshing Google Search Console token for integration ${integrationId}`, { error, integrationId })
            return false
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().google_search_console_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration || !integration.is_active) {
                logger.error(`Google Search Console integration ${integrationId} not found or inactive`, { integrationId })
                return null
            }
            const tokenInfo = await refreshAccessTokenIfNeeded(integration)
            return tokenInfo.access_token
        } catch (error) {
            logger.error(`Error getting Google Search Console access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }
}

export function getSearchConsoleOAuth2Client(): OAuth2Client {
    const config = new GoogleSearchConsoleIntegrationManager().config
    return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri)
}

type TokenInfo = {
    access_token: string
    refresh_token: string
    isRefreshed: boolean
}

async function refreshAccessTokenIfNeeded(integration: PrismaGoogleSearchConsoleIntegration): Promise<TokenInfo> {
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, recordId: integration.id }
    })
    const currentAccessToken = secrets.accessToken
    const refreshToken = secrets.refreshToken

    const oauthClient = getSearchConsoleOAuth2Client()

    if (await isAccessTokenUsable(oauthClient, currentAccessToken, integration.id)) {
        return {
            access_token: currentAccessToken,
            refresh_token: refreshToken,
            isRefreshed: false
        }
    }

    oauthClient.setCredentials({
        refresh_token: refreshToken
    })

    const { token: newAccessToken } = await oauthClient.getAccessToken()
    if (!newAccessToken) {
        throw new Error("Google did not return an access token while refreshing Search Console authorization")
    }
    await secretService.createSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.GOOGLE_SEARCH_CONSOLE, recordId: integration.id, value: { accessToken: newAccessToken } }
    })
    return {
        access_token: newAccessToken,
        refresh_token: refreshToken,
        isRefreshed: true
    }
}

async function isAccessTokenUsable(oauthClient: OAuth2Client, accessToken: string, integrationId: string): Promise<boolean> {
    try {
        const tokenInfo = await oauthClient.getTokenInfo(accessToken)
        if (tokenInfo.expiry_date > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) return true
        logger.info("Google Search Console access token is expiring soon, refreshing...", { integrationId, tokenExpiry: tokenInfo.expiry_date })
        return false
    } catch (error) {
        // An expired, revoked, or otherwise invalid access token makes getTokenInfo() throw.
        logger.info("Google Search Console access token is invalid or expired, refreshing...", { integrationId, error })
        return false
    }
}
