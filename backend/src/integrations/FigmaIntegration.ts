import { InputConfigType, figma_integrations } from "@prisma/client"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { OAUTH_TOKEN_REFRESH_THRESHOLD_MS, figma as figmaConfig, jwt as jwtConfig, nodeEnv, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { FileCategory, StoredFile } from "../services/FileStorageService"
import { ApiRoutes } from "../shared/ApiRoutes"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, FigmaIntegration, FigmaIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "../shared/Integrations"
import { RunHistoryTrigger } from "../shared/RunHistoryTypes"
import {
    FigmaApiComment,
    FigmaCommentEventData,
    FigmaCommentImageUrls,
    FigmaCommentThreadEntry,
    FigmaEventTypes,
    FigmaPositioningData,
    FigmaWebhookUser,
    OAuthInstallationDetails,
    User as SessionUser
} from "../shared/types"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { createOAuthStateToken } from "../utility/oauth"
import { generateWebhookPasscode } from "../utility/webhookSecrets"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { InputEvent } from "./abstract/InputEvent"
import { ConfigurationFieldDefinition, Integration, OAuthIntegrationInstallation } from "./abstract/Integration"

export class FigmaIntegrationManager implements Integration<FigmaIntegration, FigmaWebhookEvent, typeof FigmaIntegrationMetadata, never>, OAuthIntegrationInstallation<IntegrationType.FIGMA> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.FIGMA

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<FigmaIntegration[]> {
        const integrations = await db().figma_integrations.findMany({
            where: {
                organization_id: organizationId
            }
        })
        return integrations.map(integration => ({
            id: integration.id,
            handle: integration.handle,
            figma_user_id: integration.figma_user_id,
            token_expiry: integration.token_expiry
        }))
    }

    formatIntegrationInstanceForAgent(instance: FigmaIntegration): string {
        const details: string[] = []
        if (instance.handle) {
            details.push(`handle "${instance.handle}"`)
        }
        if (instance.figma_user_id) {
            details.push(`userId ${instance.figma_user_id}`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Figma${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<FigmaIntegration[]> {
        const integrations = await db().figma_integrations.findMany({
            select: {
                id: true,
                handle: true,
                figma_user_id: true,
                token_expiry: true
            }
        })
        return integrations.map(integration => ({
            id: integration.id,
            handle: integration.handle,
            figma_user_id: integration.figma_user_id,
            token_expiry: integration.token_expiry
        }))
    }

    async processWebhookEvent(event: FigmaWebhookEvent): Promise<void> {
        const eventType = event.event_type

        const supportedEventTypes = Object.values(FigmaEventTypes)
        if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
            logger.warn(`⚠️  Ignoring unsupported event type ${eventType}`, {
                eventType
            })
            return
        }

        const receivedPasscode = event.passcode

        const integrations = await db().figma_integrations.findMany({
            where: {
                figma_webhooks: {
                    some: {
                        passcode: receivedPasscode
                    }
                }
            },
            include: {
                user: true
            }
        })

        if (integrations.length === 0) {
            logger.warn(`⚠️  No integrations found with matching passcode`, {
                passcode: receivedPasscode
            })
            return
        }

        for (const integration of integrations) {
            if (!integration.organization_id) {
                continue
            }
            const user = await getUserForOrg(integration.user_id, integration.organization_id)
            if (!user) {
                continue
            }
            if (eventType === FigmaEventTypes.FILE_COMMENT) {
                // Process with user context for logging
                await runWithUserContext(user, async () => {
                    await this.handleFigmaCommentEvent(integration, event, user)
                })
            }
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options?: InstallationOptionsFor<IntegrationType.FIGMA>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const scope =
            "current_user:read,file_comments:read,file_content:read,file_metadata:read,file_versions:read,library_assets:read,library_content:read,team_library_content:read,file_dev_resources:read,projects:read,webhooks:read,webhooks:write"

        // Build OAuth URL with proper encoding
        const authUrl = new URL("https://www.figma.com/oauth")
        authUrl.searchParams.append("client_id", figmaConfig.clientId)
        authUrl.searchParams.append("redirect_uri", figmaConfig.redirectUrl)
        authUrl.searchParams.append("scope", scope)
        authUrl.searchParams.append("state", state)
        authUrl.searchParams.append("response_type", "code")

        return {
            oauthUrl: authUrl.toString()
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Figma OAuth error", { error: String(error) })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" })
            return
        }
        try {
            // Verify state token to prevent CSRF attacks
            const decoded = jwt.verify(state as string, jwtConfig.secret) as {
                userId: string
                organizationId: string
                timestamp: number
            }

            if (!decoded.organizationId || typeof decoded.organizationId !== "string") {
                logger.error("Figma OAuth: organizationId is required in state", {
                    userId: decoded.userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Exchange authorization code for access token
            // Figma requires application/x-www-form-urlencoded format
            const params = new URLSearchParams({
                redirect_uri: figmaConfig.redirectUrl,
                code: code as string,
                grant_type: "authorization_code"
            })

            const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
                method: "POST",
                headers: {
                    Authorization: `Basic ${Buffer.from(`${figmaConfig.clientId}:${figmaConfig.clientSecret}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params.toString()
            })

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text()
                logger.error("Figma token exchange failed", { error: errorText })
                throw new Error(`Figma token exchange failed: ${errorText}`)
            }

            const tokenData = await tokenResponse.json()
            const { access_token, refresh_token, expires_in, user_id_string } = tokenData

            logger.info("🔑 Received Figma access token for user", {
                userId: decoded.userId
            })
            logger.info("👤 Figma User ID", {
                userId: decoded.userId,
                figmaUserId: user_id_string
            })
            logger.debug("Token expires in", {
                expiresIn: expires_in,
                userId: decoded.userId
            })

            // Calculate token expiry
            const tokenExpiry = new Date(Date.now() + expires_in * 1000)

            let handle: string
            const userInfoResponse = await fetch("https://api.figma.com/v1/me", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            })

            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json()
                handle = userInfo.handle
            } else {
                throw new Error(`Failed to fetch Figma user info: ${userInfoResponse.statusText}`)
            }

            // Check if a connection for this Figma user already exists
            const existing = await db().figma_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId,
                    figma_user_id: user_id_string
                }
            })

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().figma_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId,
                        figma_user_id: user_id_string,
                        handle: handle,
                        access_token: access_token,
                        refresh_token: refresh_token || null,
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = newIntegration.id
                logger.info("✅ Created Figma connection for user", {
                    userId: decoded.userId,
                    figmaUserId: user_id_string,
                    handle
                })
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().figma_integrations.update({
                    where: { id: existing.id },
                    data: {
                        organization_id: decoded.organizationId,
                        handle: handle,
                        figma_user_id: user_id_string,
                        access_token: access_token,
                        refresh_token: refresh_token || null,
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = existing.id
                logger.info("✅ Updated Figma connection token for user", {
                    userId: decoded.userId,
                    figmaUserId: user_id_string,
                    integrationId: existing.id
                })
            }

            logger.info("✅ Figma OAuth completed for user", {
                userId: decoded.userId,
                figmaUserId: user_id_string
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.FIGMA, integrationId, decoded.userId, decoded, new Date()))

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error in Figma OAuth callback", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Check if figma_config exists at all
        if (!agentTrigger.figma_config) {
            logger.warn(`⚠️  No Figma config found for input ${agentTrigger.id}. Skipping webhook setup.`, { inputId: agentTrigger.id })
            return
        }

        const fileKey = agentTrigger.figma_config.file_key

        if (!fileKey) {
            logger.warn(`⚠️  No file_key specified in Figma config for input ${agentTrigger.id}`, { inputId: agentTrigger.id })
            return
        }

        // Get Figma integration
        const figmaIntegration = await db().figma_integrations.findFirst({
            where: { id: integrationId }
        })

        if (!figmaIntegration) {
            logger.warn(`⚠️  Figma integration not found: ${integrationId}`, {
                integrationId
            })
            return
        }

        // Get team ID from config - required for webhook creation
        const teamId = agentTrigger.figma_config.team_id

        if (!teamId) {
            throw new Error(`team_id is required for creating Figma webhooks. Please provide a team ID in the Figma configuration for file ${fileKey}.`)
        }

        // Build webhook endpoint URL
        const webhookEndpoint = `${urls.backend}${ApiRoutes.WEBHOOKS.FIGMA}`

        // Event types to monitor: comments
        const eventTypes = ["FILE_COMMENT"]

        try {
            // Get valid access token (handles refresh automatically)
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                throw new Error(`Could not get valid access token for Figma integration ${integrationId}`)
            }
            const isDevelopment = nodeEnv !== "production"

            // Create or reuse team-level webhooks for both event types
            for (const eventType of eventTypes) {
                // Check if a team-level webhook already exists for this team and event type
                const existingWebhook = await db().figma_webhooks.findFirst({
                    where: {
                        figma_integration_id: figmaIntegration.id,
                        team_id: teamId,
                        event_type: eventType
                    }
                })

                // In development, always delete and recreate webhooks
                if (isDevelopment && existingWebhook) {
                    logger.info(`🔄 Development mode: Deleting existing webhook ${existingWebhook.webhook_id} for team ${teamId}, event ${eventType}`, {
                        webhookId: existingWebhook.webhook_id,
                        teamId,
                        eventType
                    })

                    // Delete webhook from Figma API
                    try {
                        const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${existingWebhook.webhook_id}`, {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${accessToken}`
                            }
                        })

                        if (!deleteResponse.ok && deleteResponse.status !== 404) {
                            const errorText = await deleteResponse.text()
                            logger.error(`Failed to delete existing Figma webhook ${existingWebhook.webhook_id}`, {
                                error: errorText,
                                webhookId: existingWebhook.webhook_id,
                                teamId
                            })
                        } else {
                            logger.info(`✅ Deleted existing webhook ${existingWebhook.webhook_id}`, { webhookId: existingWebhook.webhook_id, teamId })
                        }
                    } catch (error) {
                        logger.error(`❌ Error deleting existing webhook ${existingWebhook.webhook_id}`, { error, webhookId: existingWebhook.webhook_id, teamId })
                    }

                    // Delete webhook record from database
                    await db().figma_webhooks.delete({
                        where: { id: existingWebhook.id }
                    })
                } else if (existingWebhook) {
                    // In production, reuse existing webhook
                    logger.info(`ℹ️  Team-level webhook already exists for team ${teamId}, event ${eventType}. Reusing existing webhook ${existingWebhook.webhook_id}`, {
                        webhookId: existingWebhook.webhook_id,
                        teamId,
                        eventType
                    })
                    continue // Webhook already exists, skip creation
                }

                // Generate secure passcode for webhook verification
                const passcode = generateWebhookPasscode()

                // Create team-level webhook (no file_key - monitors entire team)
                const webhookResponse = await fetch("https://api.figma.com/v2/webhooks", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        event_type: eventType,
                        team_id: teamId,
                        // No file_key - this is a team-level webhook
                        endpoint: webhookEndpoint,
                        passcode: passcode
                    })
                })

                if (!webhookResponse.ok) {
                    const errorText = await webhookResponse.text()
                    logger.error(`Failed to create Figma webhook for ${eventType}`, {
                        error: errorText,
                        eventType,
                        teamId
                    })
                    throw new Error(`Failed to create Figma webhook for ${eventType}: ${errorText}`)
                }

                const webhookData = await webhookResponse.json()
                const webhookId = webhookData.webhook?.id || webhookData.id

                if (!webhookId) {
                    throw new Error(`Webhook ID not returned from Figma API for ${eventType}`)
                }

                // Store team-level webhook in database
                await db().figma_webhooks.create({
                    data: {
                        figma_integration_id: figmaIntegration.id,
                        webhook_id: webhookId,
                        team_id: teamId,
                        endpoint_url: webhookEndpoint,
                        passcode: passcode,
                        event_type: eventType
                    }
                })

                logger.info(`✅ Created team-level Figma webhook ${webhookId} for team ${teamId}, event ${eventType}`, { webhookId, teamId, eventType })
            }
        } catch (error) {
            logger.error(`❌ Error creating Figma webhooks for team ${teamId}`, {
                error,
                teamId
            })
            throw error
        }
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        const teamId = agentTrigger.figma_config?.team_id

        if (!teamId) {
            logger.info(`ℹ️  No team_id in config, skipping webhook cleanup for channel input ${agentTrigger.id}`, { inputId: agentTrigger.id })
            return
        }

        // Get Figma integration
        const figmaIntegration = await db().figma_integrations.findFirst({
            where: { id: integrationId }
        })

        if (!figmaIntegration) {
            logger.warn(`⚠️  Figma integration not found: ${integrationId}`, {
                integrationId
            })
            return
        }

        // Check if any other active automations are using this team
        const otherAutomations = await db().automation_inputs.findMany({
            where: {
                config_type: InputConfigType.FIGMA,
                automation: {
                    is_active: true
                },
                NOT: {
                    id: agentTrigger.id
                }
            },
            include: {
                figma_config: true
            }
        })

        // Check if any other active channel uses the same team
        const otherTeamUsers = otherAutomations.filter(input => input.figma_config?.team_id === teamId)

        if (otherTeamUsers.length > 0) {
            logger.info(`ℹ️  Team ${teamId} still in use by ${otherTeamUsers.length} other automation(s). Keeping team-level webhooks.`, {
                teamId,
                otherAutomationsCount: otherTeamUsers.length,
                integrationId
            })
            return // Don't delete webhooks, other automations are using them
        }

        // No other automations use this team, so we can delete the team-level webhooks
        const webhooks = await db().figma_webhooks.findMany({
            where: {
                figma_integration_id: figmaIntegration.id,
                team_id: teamId
            }
        })

        if (webhooks.length === 0) {
            logger.info(`ℹ️  No webhooks found for team ${teamId}`, {
                teamId,
                integrationId
            })
            return
        }

        // Get valid access token (handles refresh automatically)
        const accessToken = await this.getAccessToken(integrationId)
        if (!accessToken) {
            logger.warn(`⚠️  Could not get valid access token, skipping webhook deletion`, { integrationId, teamId })
            return
        }

        // Delete all team-level webhooks for this team
        for (const webhook of webhooks) {
            try {
                const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${webhook.webhook_id}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                })

                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    // 404 means webhook already deleted, which is fine
                    const errorText = await deleteResponse.text()
                    logger.error(`Failed to delete Figma webhook ${webhook.webhook_id} (${webhook.event_type})`, {
                        error: errorText,
                        webhookId: webhook.webhook_id,
                        eventType: webhook.event_type,
                        teamId
                    })
                } else {
                    logger.info(`✅ Deleted team-level Figma webhook ${webhook.webhook_id} (${webhook.event_type}) for team ${teamId}`, {
                        webhookId: webhook.webhook_id,
                        eventType: webhook.event_type,
                        teamId
                    })
                }
            } catch (error) {
                logger.error(`❌ Error deleting Figma webhook ${webhook.webhook_id}`, {
                    error,
                    webhookId: webhook.webhook_id,
                    teamId
                })
                // Continue with database cleanup even if API call fails
            }
        }

        // Delete webhook records from database
        await db().figma_webhooks.deleteMany({
            where: {
                figma_integration_id: figmaIntegration.id,
                team_id: teamId
            }
        })

        logger.info(`📤 Team ${teamId} no longer monitored by any automations`, {
            teamId,
            integrationId
        })
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().figma_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.warn(`Figma integration ${integrationId} not found`, {
                    integrationId
                })
                return false
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry

            // Use getAccessToken which internally handles token refresh
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                // Check if token was actually refreshed by comparing expiry dates
                const updatedIntegration = await db().figma_integrations.findUnique({
                    where: { id: integrationId },
                    select: { token_expiry: true }
                })

                if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                    return false
                }

                // If expiry changed, token was refreshed
                return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime()
            }

            // Check if token was refreshed by comparing expiry dates
            const updatedIntegration = await db().figma_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true }
            })

            if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                return false
            }

            // Token was refreshed if expiry changed
            return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime()
        } catch (error) {
            logger.error(`Error refreshing Figma token for integration ${integrationId}`, { error, integrationId })
            return false
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().figma_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.error(`Figma integration ${integrationId} not found`, {
                    integrationId
                })
                return null
            }

            const now = new Date()
            // Check if token is expired or will expire within the refresh threshold
            if (integration.token_expiry && integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)) {
                logger.info(`Figma access token expiring soon for integration ${integrationId}, refreshing...`, { integrationId })

                if (!integration.refresh_token) {
                    logger.error(`No refresh token available for Figma integration ${integrationId}`, { integrationId })
                    return integration.access_token // Return existing token as fallback
                }

                // Exchange refresh token for new access token
                // Figma requires application/x-www-form-urlencoded format
                const params = new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: integration.refresh_token
                })

                const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${figmaConfig.clientId}:${figmaConfig.clientSecret}`).toString("base64")}`,
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: params.toString()
                })

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text()
                    logger.error(`Figma token refresh failed for integration ${integrationId}`, { error: errorText, integrationId })
                    // Return existing token as fallback - it might still work
                    return integration.access_token
                }

                const tokenData = await tokenResponse.json()
                const { access_token, refresh_token, expires_in } = tokenData

                if (!access_token) {
                    logger.error(`No access token received from Figma refresh for integration ${integrationId}`, { integrationId })
                    // Return existing token as fallback
                    return integration.access_token
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + expires_in * 1000)

                // Update the database with new tokens
                await db().figma_integrations.update({
                    where: { id: integration.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || integration.refresh_token, // Preserve existing if new one not provided
                        token_expiry: tokenExpiry
                    }
                })

                logger.info(`Successfully refreshed Figma access token for integration ${integrationId}`, { integrationId })
                return access_token
            }

            // Token is still valid
            return integration.access_token
        } catch (error) {
            logger.error(`Error getting Figma access token for integration ${integrationId}`, { error, integrationId })
            // Return null on error - caller should handle
            return null
        }
    }

    /**
     * Handle FILE_COMMENT webhook events
     * Comment data is included in the webhook payload
     * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
     */
    private async handleFigmaCommentEvent(integration: figma_integrations, webhookEvent: FigmaWebhookEvent, user: SessionUser): Promise<void> {
        // Extract comment_id from top level (Figma webhook structure)
        const commentId = webhookEvent.comment_id
        const fileKey = webhookEvent.file_key
        if (!commentId) {
            logger.warn(`⚠️  FILE_COMMENT event missing comment_id`, {
                webhookEvent: JSON.stringify(webhookEvent, null, 2),
                integrationId: integration.id
            })
            return
        }
        if (!fileKey) {
            logger.warn(`⚠️  FILE_COMMENT event missing file_key`, {
                webhookEvent: JSON.stringify(webhookEvent, null, 2),
                integrationId: integration.id
            })
            return
        }
        logger.info(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`, { fileKey, commentId, integrationId: integration.id })

        // Process the comment once per integration, to prevent duplicate processing
        try {
            await db().processed_figma_comments.create({
                data: {
                    figma_integration_id: integration.id,
                    comment_id: commentId,
                    file_key: fileKey
                }
            })
        } catch (error: any) {
            // Race condition - comment already being processed
            if (error.code === "P2002") {
                logger.info(`ℹ️  Comment ${commentId} already being processed`, {
                    commentId,
                    fileKey,
                    integrationId: integration.id
                })
                return
            }
            throw error
        }

        // Get valid access token (handles refresh automatically)
        const accessToken = await this.getAccessToken(integration.id)
        if (!accessToken) {
            logger.warn(`⚠️  Could not get valid access token for Figma integration ${integration.id}`, { integrationId: integration.id, fileKey, commentId })
            return
        }

        // Fetch comment details from Figma API to get client_meta
        // client_meta is not included in the webhook payload
        const commentThreadData = await fetchFigmaCommentThreadFromApi(accessToken, fileKey, commentId)
        if (!commentThreadData) {
            logger.warn(`⚠️  Could not fetch comment ${commentId} from API`, {
                commentId,
                fileKey,
                integrationId: integration.id
            })
            return
        }

        const { comment: commentFromApi, thread } = commentThreadData

        const { rootComment, positioningComment, positioningData } = resolvePositioningContext(commentFromApi, thread)

        logger.debug(`Client Meta (event comment)`, {
            clientMeta: JSON.stringify(commentFromApi.client_meta, null, 2),
            commentId,
            fileKey
        })
        if (positioningComment && positioningComment.id !== commentFromApi.id) {
            logger.debug(`Using comment ${positioningComment.id} client_meta for positioning`, {
                positioningCommentId: positioningComment.id,
                clientMeta: JSON.stringify(positioningComment.client_meta, null, 2),
                commentId
            })
        }
        logger.debug(`📍 Positioning data for comment ${commentId}`, {
            positioningData: positioningData ? JSON.stringify(positioningData, null, 2) : "null (empty client_meta)",
            commentId,
            fileKey
        })

        // Map comment to design elements using positioning data
        let matchedNodeIds: string[] = []
        try {
            const nodeId = positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id
            matchedNodeIds = await mapCommentToDesignElements(accessToken, fileKey, positioningData, nodeId)
            logger.debug(`🎯 Matched ${matchedNodeIds.length} node(s) for comment ${commentId}`, {
                matchedNodes: matchedNodeIds.length > 0 ? matchedNodeIds.join(", ") : "none",
                nodeCount: matchedNodeIds.length,
                commentId,
                fileKey
            })
        } catch (error) {
            logger.error(`Error mapping comment ${commentId} to design elements`, {
                error,
                commentId,
                fileKey
            })
            // Continue with empty array if mapping fails
        }

        // Extract images for visual context
        let imageUrls: FigmaCommentImageUrls = {
            nodeImage: undefined,
            fullFrame: undefined
        }
        try {
            imageUrls = await extractCommentImages(accessToken, fileKey, matchedNodeIds, positioningData)
            logger.debug(`🖼️  Extracted images for comment ${commentId}`, {
                imageCount: Object.keys(imageUrls).length,
                hasImages: Object.keys(imageUrls).length > 0,
                commentId,
                fileKey
            })
        } catch (error) {
            logger.error(`Error extracting images for comment ${commentId}`, {
                error,
                commentId,
                fileKey
            })
            // Continue with empty object if image extraction fails
        }

        logger.info("Figma for comment imageUrls", {
            imageUrls: JSON.stringify(imageUrls, null, 2),
            commentId,
            fileKey
        })

        // Get the closest node ID for storage
        const closestNodeId = matchedNodeIds.length > 0 ? matchedNodeIds[0] : (positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id ?? null)

        const fileMetadata = await fetchFileMetadata(accessToken, fileKey)
        if (!fileMetadata) {
            logger.warn(`⚠️  Could not fetch file metadata for file ${fileKey}`, {
                fileKey,
                commentId,
                integrationId: integration.id
            })
            return
        }

        // Map thread from FigmaApiComment[] to FigmaCommentThreadEntry[]
        const threadEntries: FigmaCommentThreadEntry[] = thread.map(comment => ({
            id: comment.id,
            message: comment.message,
            author: comment.user,
            createdAt: comment.created_at,
            resolvedAt: comment.resolved_at,
            parentId: comment.parent_id ?? null,
            orderId: comment.order_id,
            isRoot: !comment.parent_id
        }))

        // Convert resolved_at to boolean, and positioningData null to undefined
        const resolved = commentFromApi.resolved_at !== null
        const positioningDataOrUndefined = positioningData ?? undefined

        const figmaEvent = new FigmaCommentEvent({
            commentId: commentId,
            fileKey: fileKey,
            fileUrl: fileMetadata.url,
            nodeId: closestNodeId || undefined,
            message: commentFromApi.message || "",
            author: commentFromApi.user,
            createdAt: commentFromApi.created_at,
            resolved: resolved,
            thread: threadEntries,
            fileMetadata: fileMetadata,
            positioningData: positioningDataOrUndefined,
            matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
            imageUrls: imageUrls.nodeImage || imageUrls.fullFrame ? imageUrls : undefined
        })

        const eventProcessor = new EventProcessor(figmaEvent, user)
        await eventProcessor.process()
    }
}

// MARK: - FigmaCommentEvent

export class FigmaCommentEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.FIGMA
    data: FigmaCommentEventData

    constructor(data: FigmaCommentEventData) {
        super()
        this.data = data
    }

    formatForAgentRunner(): string {
        const indentMultiline = (text: string): string =>
            text
                .split("\n")
                .map(line => `        ${line}`)
                .join("\n")

        let imageInfo = ""
        if (this.data.imageUrls) {
            const imageLines: string[] = []
            if (this.data.imageUrls.nodeImage) {
                imageLines.push(`- Primary Node Image: ${this.data.imageUrls.nodeImage}`)
            }
            if (this.data.imageUrls.fullFrame) {
                imageLines.push(`- Full Frame Image: ${this.data.imageUrls.fullFrame}`)
            }
            if (imageLines.length > 0) {
                imageLines.push("- Note: Use these images to understand what element the comment refers to.")
                imageInfo = `Visual Context:\n${indentMultiline(imageLines.join("\n"))}`
            }
        }

        const threadEntries = this.data.thread ? [...this.data.thread] : []
        const currentThreadEntry = threadEntries.find(entry => entry.id === this.data.commentId)
        const parentThreadEntry = currentThreadEntry?.parentId ? threadEntries.find(entry => entry.id === currentThreadEntry.parentId) : undefined
        const rootThreadEntry = threadEntries.find(entry => entry.isRoot) ?? threadEntries[0]

        const formatThreadMessage = (entry: FigmaCommentThreadEntry): string => {
            const flags: string[] = []
            if (entry.isRoot) {
                flags.push("root comment")
            }
            if (entry.id === this.data.commentId) {
                flags.push("current event")
            }
            if (entry.parentId && entry.parentId !== entry.id) {
                flags.push("reply")
            }
            if (entry.resolvedAt) {
                flags.push(`resolved on ${entry.resolvedAt}`)
            }

            const metadata = flags.length > 0 ? ` [${flags.join(" | ")}]` : ""
            const header = `${entry.author.handle} on ${entry.createdAt}${metadata}`
            const messageBody =
                entry.message && entry.message.trim().length > 0
                    ? entry.message
                          .split("\n")
                          .map(line => `  ${line}`)
                          .join("\n")
                    : "  (no message)"

            return `${header}\n${messageBody}`
        }

        const formatContextEntry = (entry: FigmaCommentThreadEntry): string => {
            const header = `${entry.author.handle} on ${entry.createdAt}`
            const messageBody =
                entry.message && entry.message.trim().length > 0
                    ? entry.message
                          .split("\n")
                          .map(line => `  ${line}`)
                          .join("\n")
                    : "  (no message)"

            return `${header}\n${messageBody}`
        }

        const messageBlock = this.data.message && this.data.message.trim().length > 0 ? `Comment Message:\n${indentMultiline(this.data.message)}` : ""

        const directParentBlock = parentThreadEntry && parentThreadEntry.id !== this.data.commentId ? `Direct Parent Comment:\n${indentMultiline(formatContextEntry(parentThreadEntry))}` : ""

        const rootThreadBlock =
            rootThreadEntry && rootThreadEntry.id !== this.data.commentId && rootThreadEntry.id !== parentThreadEntry?.id
                ? `Thread Starting Comment:\n${indentMultiline(formatContextEntry(rootThreadEntry))}`
                : ""

        const threadInfo =
            threadEntries.length > 0
                ? `Full Comment Thread (oldest → newest):\n${indentMultiline(
                      threadEntries
                          .map((entry, index) => {
                              const prefix = `${index + 1}. `
                              const formatted = formatThreadMessage(entry).split("\n")
                              const withIndex = [formatted[0] ? `${prefix}${formatted[0]}` : prefix, ...formatted.slice(1)]
                              return withIndex.join("\n")
                          })
                          .join("\n\n")
                  )}`
                : ""

        const conversationContextSections = [messageBlock, directParentBlock, rootThreadBlock, threadInfo].filter(section => section && section.trim().length > 0)

        const conversationContext = conversationContextSections.join("\n\n")

        const fileName = typeof this.data.fileMetadata?.name === "string" ? this.data.fileMetadata.name : null
        const folderName = typeof this.data.fileMetadata?.folder_name === "string" ? this.data.fileMetadata.folder_name : null

        const designContextLines: string[] = []
        designContextLines.push(`Design File: ${fileName || "Untitled Figma file"}`)
        if (folderName) {
            designContextLines.push(`Location: ${folderName}`)
        }
        designContextLines.push(`Open in Figma: ${this.data.fileUrl}`)

        const designContext = `Context:\n${indentMultiline(designContextLines.join("\n"))}`

        const summarySection = ["Incoming Figma Comment Event", `Author: ${this.data.author.handle}`, `Created: ${this.data.createdAt}`, `Status: ${this.data.resolved ? "Resolved" : "Open"}`].join(
            "\n"
        )

        const sections = [summarySection, designContext, conversationContext, imageInfo].filter(section => section && section.trim().length > 0)

        return `${sections.join("\n\n")}\n`
    }

    debugLog(): string {
        return `Figma Comment Event: File ${this.data.fileKey} - ${this.data.author.handle} - ${this.data.message.substring(0, 50)}`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        // Check if integration type matches
        if (agentTrigger.config_type !== InputConfigType.FIGMA) {
            return false
        }

        // Require file_key to be configured and match the event's file_key
        const figmaConfig = agentTrigger.figma_config
        if (!figmaConfig?.file_key) {
            // No file_key configured means this channel should not match any events
            return false
        }

        // Event's file_key must match the channel input's file_key
        return this.data.fileKey === figmaConfig.file_key
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Get file name from metadata, fall back to file key if not available
        const fileName = this.data.fileMetadata?.name || this.data.fileKey
        const subheader = `${this.data.author.handle} on ${fileName}`

        return {
            event: "comment_added",
            integration: IntegrationType.FIGMA,
            source: this.data.fileKey,
            title: this.data.message.substring(0, 100), // First 100 chars of comment
            subheader: subheader,
            url: this.data.fileUrl
        }
    }

    getFiles(): StoredFile[] {
        // Return all available image URLs from the Figma comment event
        const storedFiles: StoredFile[] = []
        if (this.data.imageUrls) {
            if (this.data.imageUrls.nodeImage) {
                storedFiles.push({
                    url: this.data.imageUrls.nodeImage,
                    mimeType: "image/png",
                    category: FileCategory.IMAGE
                })
            }
            if (this.data.imageUrls.fullFrame) {
                storedFiles.push({
                    url: this.data.imageUrls.fullFrame,
                    mimeType: "image/png",
                    category: FileCategory.IMAGE
                })
            }
        }
        return storedFiles
    }
}

// MARK: - Helper Functions

/**
 * Get Figma access token for a user
 */
export async function getFigmaAccessToken(userId: string): Promise<string> {
    const figmaIntegration = await db().figma_integrations.findFirst({
        where: {
            user_id: userId
        },
        orderBy: {
            created_at: "desc"
        }
    })

    if (!figmaIntegration) {
        throw new Error("Figma integration not found")
    }

    if (figmaIntegration.token_expiry && new Date() > figmaIntegration.token_expiry) {
        throw new Error("Figma access token has expired. Please re-authenticate.")
    }

    return figmaIntegration.access_token
}

/**
 * Fetch file metadata for a file
 */
export async function fetchFileMetadata(accessToken: string, fileKey: string): Promise<any> {
    try {
        // Using /v1/files/:key/meta endpoint which returns { file: { ... } }
        const metadataResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/meta`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        if (metadataResponse.ok) {
            const metadataData = await metadataResponse.json()
            // Extract the file property from the response
            const fileMetadata = metadataData.file || metadataData
            logger.info(`✅ Fetched file metadata for ${fileKey}`, {
                fileKey,
                fileName: fileMetadata?.name || "unknown file"
            })
            return fileMetadata
        } else {
            const errorText = await metadataResponse.text()
            logger.error(`Failed to fetch file metadata for ${fileKey}`, {
                error: errorText,
                fileKey
            })
            return null
        }
    } catch (error) {
        logger.error("Error fetching file metadata", { error, fileKey })
        return null
    }
}

/**
 * Parse client_meta positioning data from Figma comment
 * Returns the positioning type and normalized data structure
 */
export function parsePositioningData(clientMeta: any): FigmaPositioningData | null {
    if (!clientMeta || typeof clientMeta !== "object") {
        return null
    }

    // Check for Vector: { x: number, y: number }
    if (typeof clientMeta.x === "number" && typeof clientMeta.y === "number" && !clientMeta.width && !clientMeta.height && !clientMeta.node_id) {
        return {
            type: "Vector",
            data: { x: clientMeta.x, y: clientMeta.y }
        }
    }

    // Check for FrameOffset: { node_id: string, node_offset: { x: number, y: number } }
    if (clientMeta.node_id && clientMeta.node_offset && typeof clientMeta.node_offset.x === "number" && typeof clientMeta.node_offset.y === "number") {
        return {
            type: "FrameOffset",
            data: {
                node_id: clientMeta.node_id,
                node_offset: {
                    x: clientMeta.node_offset.x,
                    y: clientMeta.node_offset.y
                }
            }
        }
    }

    // Check for Region: { x: number, y: number, width: number, height: number }
    if (typeof clientMeta.x === "number" && typeof clientMeta.y === "number" && typeof clientMeta.width === "number" && typeof clientMeta.height === "number" && !clientMeta.node_id) {
        return {
            type: "Region",
            data: {
                x: clientMeta.x,
                y: clientMeta.y,
                width: clientMeta.width,
                height: clientMeta.height
            }
        }
    }

    // Check for FrameOffsetRegion: Combination of FrameOffset and Region
    if (
        clientMeta.node_id &&
        clientMeta.node_offset &&
        typeof clientMeta.x === "number" &&
        typeof clientMeta.y === "number" &&
        typeof clientMeta.width === "number" &&
        typeof clientMeta.height === "number"
    ) {
        return {
            type: "FrameOffsetRegion",
            data: {
                node_id: clientMeta.node_id,
                node_offset: clientMeta.node_offset,
                x: clientMeta.x,
                y: clientMeta.y,
                width: clientMeta.width,
                height: clientMeta.height
            }
        }
    }

    // Also check for node_id-only positioning (common case)
    if (clientMeta.node_id) {
        return {
            type: "FrameOffset",
            data: {
                node_id: clientMeta.node_id,
                node_offset: clientMeta.node_offset || { x: 0, y: 0 }
            }
        }
    }

    return null
}

/**
 * Map comment position to design elements in the file
 * Returns array of node IDs that match the comment position
 */
export async function mapCommentToDesignElements(accessToken: string, fileKey: string, positioningData: { type: string; data: any } | null, existingNodeId?: string): Promise<string[]> {
    const matchedNodeIds: string[] = []

    try {
        // If we already have a node_id from client_meta, use it
        if (existingNodeId) {
            matchedNodeIds.push(existingNodeId)
        }

        // If no positioning data, try to get root page/document nodes for file-level comments
        if (!positioningData) {
            // For file-level comments, try to get the document root or first page
            try {
                const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                })

                if (fileResponse.ok) {
                    const fileData = await fileResponse.json()
                    const document = fileData.document

                    if (document) {
                        // Get root page nodes (CANVAS type) or the document itself
                        const findRootPages = (node: any, pages: string[] = []): void => {
                            // CANVAS nodes are typically pages in Figma
                            if (node.type === "CANVAS" || node.type === "FRAME") {
                                pages.push(node.id)
                            }
                            // Limit to first 3 pages to avoid too many
                            if (node.children && pages.length < 3) {
                                for (const child of node.children) {
                                    findRootPages(child, pages)
                                }
                            }
                        }

                        const rootPages: string[] = []
                        findRootPages(document, rootPages)

                        // Add root pages to matched nodes for file-level comments
                        for (const pageId of rootPages) {
                            if (!matchedNodeIds.includes(pageId)) {
                                matchedNodeIds.push(pageId)
                            }
                        }

                        // If no pages found, use the document root itself
                        if (matchedNodeIds.length === 0 && document.id) {
                            matchedNodeIds.push(document.id)
                        }
                    }
                }
            } catch (error) {
                logger.error(`Error fetching file for file-level comment context`, {
                    error,
                    fileKey
                })
            }

            return matchedNodeIds
        }

        // Fetch full file JSON to get all nodes and their positions
        const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        if (!fileResponse.ok) {
            const errorText = await fileResponse.text()
            logger.error(`Failed to fetch file JSON for ${fileKey}`, {
                error: errorText,
                fileKey
            })
            return matchedNodeIds // Return existing node_id if we have it
        }

        const fileData = await fileResponse.json()
        const document = fileData.document

        if (!document) {
            return matchedNodeIds
        }

        // Helper function to recursively find all nodes with their bounds
        const findNodesWithBounds = (node: any, nodes: Array<{ id: string; bounds: any; name: string }> = []): void => {
            if (node.absoluteBoundingBox || node.relativeTransform) {
                const bounds = node.absoluteBoundingBox || {
                    x: node.relativeTransform?.[0]?.[2] || 0,
                    y: node.relativeTransform?.[1]?.[2] || 0,
                    width: node.absoluteBoundingBox?.width || 0,
                    height: node.absoluteBoundingBox?.height || 0
                }

                nodes.push({
                    id: node.id,
                    bounds: bounds,
                    name: node.name || "Unnamed"
                })
            }

            if (node.children) {
                for (const child of node.children) {
                    findNodesWithBounds(child, nodes)
                }
            }
        }

        const allNodes: Array<{ id: string; bounds: any; name: string }> = []
        findNodesWithBounds(document, allNodes)

        // Match based on positioning type
        if (positioningData.type === "Vector") {
            // For Vector, find nodes that contain the point
            const { x, y } = positioningData.data
            for (const node of allNodes) {
                const bounds = node.bounds
                if (bounds && x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
                    if (!matchedNodeIds.includes(node.id)) {
                        matchedNodeIds.push(node.id)
                    }
                }
            }
        } else if (positioningData.type === "Region") {
            // For Region, find nodes that overlap with the region
            const { x, y, width, height } = positioningData.data
            const regionBounds = { x, y, width, height }

            for (const node of allNodes) {
                const bounds = node.bounds
                if (
                    bounds &&
                    !(
                        regionBounds.x + regionBounds.width < bounds.x ||
                        regionBounds.x > bounds.x + regionBounds.width ||
                        regionBounds.y + regionBounds.height < bounds.y ||
                        regionBounds.y > bounds.y + bounds.height
                    )
                ) {
                    // Overlaps
                    if (!matchedNodeIds.includes(node.id)) {
                        matchedNodeIds.push(node.id)
                    }
                }
            }
        } else if (positioningData.type === "FrameOffset" || positioningData.type === "FrameOffsetRegion") {
            // For FrameOffset, the node_id is already in the data
            const nodeId = positioningData.data.node_id
            if (nodeId && !matchedNodeIds.includes(nodeId)) {
                matchedNodeIds.push(nodeId)
            }

            // For FrameOffsetRegion, also check region overlap
            if (positioningData.type === "FrameOffsetRegion" && positioningData.data.x !== undefined) {
                const { x, y, width, height } = positioningData.data
                const regionBounds = { x, y, width, height }

                for (const node of allNodes) {
                    const bounds = node.bounds
                    if (
                        bounds &&
                        !(
                            regionBounds.x + regionBounds.width < bounds.x ||
                            regionBounds.x > bounds.x + bounds.width ||
                            regionBounds.y + regionBounds.height < bounds.y ||
                            regionBounds.y > bounds.y + bounds.height
                        )
                    ) {
                        if (!matchedNodeIds.includes(node.id)) {
                            matchedNodeIds.push(node.id)
                        }
                    }
                }
            }
        }

        // Sort by specificity (smaller nodes first, as they're more specific)
        matchedNodeIds.sort((id1, id2) => {
            const node1 = allNodes.find(n => n.id === id1)
            const node2 = allNodes.find(n => n.id === id2)
            if (!node1 || !node2) return 0
            const area1 = (node1.bounds?.width || 0) * (node1.bounds?.height || 0)
            const area2 = (node2.bounds?.width || 0) * (node2.bounds?.height || 0)
            return area1 - area2
        })
    } catch (error) {
        logger.error("Error mapping comment to design elements", {
            error,
            fileKey
        })
        // Return existing node_id if we have it, even if mapping failed
    }

    return matchedNodeIds
}

/**
 * Extract images for comment context from Figma API
 * Returns object with image URLs for different context levels
 */
export async function extractCommentImages(accessToken: string, fileKey: string, nodeIds: string[], positioningData: { type: string; data: any } | null): Promise<FigmaCommentImageUrls> {
    const imageUrls: FigmaCommentImageUrls = {}

    try {
        if (nodeIds.length === 0) {
            // No nodes to extract - might be file-level comment
            // For file-level comments, try to extract the first page/document
            if (!positioningData) {
                // Try to get document root or first page
                try {
                    const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    })

                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json()
                        const document = fileData.document

                        if (document) {
                            // Find first CANVAS (page) or use document root
                            let pageNodeId: string | null = null

                            const findFirstPage = (node: any): void => {
                                if (node.type === "CANVAS" || (node.type === "FRAME" && !pageNodeId)) {
                                    pageNodeId = node.id
                                }
                                if (!pageNodeId && node.children) {
                                    for (const child of node.children) {
                                        findFirstPage(child)
                                        if (pageNodeId) break
                                    }
                                }
                            }

                            findFirstPage(document)

                            const targetNodeId = pageNodeId || document.id

                            if (targetNodeId) {
                                const imageResponse = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetNodeId)}&format=png&scale=1`, {
                                    method: "GET",
                                    headers: {
                                        Authorization: `Bearer ${accessToken}`
                                    }
                                })

                                if (imageResponse.ok) {
                                    const imageData = await imageResponse.json()
                                    if (imageData.images && imageData.images[targetNodeId]) {
                                        imageUrls.fullFrame = imageData.images[targetNodeId]
                                        logger.debug(`📄 Extracted full page image for file-level comment`, { fileKey, targetNodeId })
                                    } else {
                                        logger.info(`Unable to get valid image for file-level comment: image data missing or empty`, {
                                            fileKey,
                                            targetNodeId,
                                            hasImages: !!imageData.images,
                                            imageKeys: imageData.images ? Object.keys(imageData.images) : []
                                        })
                                    }
                                } else {
                                    const errorText = await imageResponse.text()
                                    logger.info(`Unable to get image for file-level comment: API returned non-ok status`, {
                                        fileKey,
                                        targetNodeId,
                                        status: imageResponse.status,
                                        statusText: imageResponse.statusText,
                                        error: errorText
                                    })
                                }
                            } else {
                                logger.info(`Unable to get image for file-level comment: no target node ID found`, { fileKey, pageNodeId, documentId: document.id })
                            }
                        } else {
                            logger.info(`Unable to get image for file-level comment: document not found in file data`, { fileKey })
                        }
                    } else {
                        const errorText = await fileResponse.text()
                        logger.info(`Unable to get image for file-level comment: file API returned non-ok status`, {
                            fileKey,
                            status: fileResponse.status,
                            statusText: fileResponse.statusText,
                            error: errorText
                        })
                    }
                } catch (error) {
                    logger.error(`Error extracting file-level comment image`, {
                        error,
                        fileKey
                    })
                }
            }
            return imageUrls
        }

        // Primary node image - the specific node the comment is on
        const primaryNodeId = nodeIds[0]
        if (primaryNodeId) {
            const imageResponse = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(primaryNodeId)}&format=png&scale=2`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            if (imageResponse.ok) {
                const imageData = await imageResponse.json()
                if (imageData.images && imageData.images[primaryNodeId]) {
                    imageUrls.nodeImage = imageData.images[primaryNodeId]
                } else {
                    logger.info(`Unable to get valid node image: image data missing or empty`, {
                        fileKey,
                        primaryNodeId,
                        hasImages: !!imageData.images,
                        imageKeys: imageData.images ? Object.keys(imageData.images) : []
                    })
                }
            } else {
                const errorText = await imageResponse.text()
                logger.error(`Failed to extract node image for ${primaryNodeId}`, {
                    error: errorText,
                    fileKey,
                    primaryNodeId
                })
                logger.info(`Unable to get node image: API returned non-ok status`, {
                    fileKey,
                    primaryNodeId,
                    status: imageResponse.status,
                    statusText: imageResponse.statusText,
                    error: errorText
                })
            }
        }

        // Full frame image - extract the page/frame containing the comment
        // Find the page (CANVAS) that contains the primary node
        try {
            const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            if (fileResponse.ok) {
                const fileData = await fileResponse.json()
                const document = fileData.document

                if (document && primaryNodeId) {
                    // Find the page (CANVAS) that contains the primary node
                    let pageNodeId: string | null = null

                    const findPageForNode = (node: any, targetId: string): void => {
                        if (node.type === "CANVAS") {
                            // Check if this page contains the target node
                            const containsNode = (n: any): boolean => {
                                if (n.id === targetId) return true
                                if (n.children) {
                                    return n.children.some((child: any) => containsNode(child))
                                }
                                return false
                            }

                            if (containsNode(node)) {
                                pageNodeId = node.id
                                return
                            }
                        }

                        if (node.children && !pageNodeId) {
                            for (const child of node.children) {
                                findPageForNode(child, targetId)
                                if (pageNodeId) break
                            }
                        }
                    }

                    findPageForNode(document, primaryNodeId)

                    const targetFrameId = pageNodeId || primaryNodeId

                    if (targetFrameId) {
                        const fullFrameResponse = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetFrameId)}&format=png&scale=1`, {
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${accessToken}`
                            }
                        })

                        if (fullFrameResponse.ok) {
                            const fullFrameData = await fullFrameResponse.json()
                            if (fullFrameData.images && fullFrameData.images[targetFrameId]) {
                                imageUrls.fullFrame = fullFrameData.images[targetFrameId]
                            } else {
                                logger.info(`Unable to get valid full frame image: image data missing or empty`, {
                                    fileKey,
                                    targetFrameId,
                                    primaryNodeId,
                                    pageNodeId,
                                    hasImages: !!fullFrameData.images,
                                    imageKeys: fullFrameData.images ? Object.keys(fullFrameData.images) : []
                                })
                            }
                        } else {
                            const errorText = await fullFrameResponse.text()
                            logger.info(`Unable to get full frame image: API returned non-ok status`, {
                                fileKey,
                                targetFrameId,
                                primaryNodeId,
                                pageNodeId,
                                status: fullFrameResponse.status,
                                statusText: fullFrameResponse.statusText,
                                error: errorText
                            })
                        }
                    } else {
                        logger.info(`Unable to get full frame image: no target frame ID found`, { fileKey, primaryNodeId, pageNodeId })
                    }
                } else {
                    if (!document) {
                        logger.info(`Unable to get full frame image: document not found in file data`, { fileKey, primaryNodeId })
                    }
                    if (!primaryNodeId) {
                        logger.info(`Unable to get full frame image: no primary node ID available`, { fileKey })
                    }
                }
            } else {
                const errorText = await fileResponse.text()
                logger.info(`Unable to get full frame image: file API returned non-ok status`, {
                    fileKey,
                    primaryNodeId,
                    status: fileResponse.status,
                    statusText: fileResponse.statusText,
                    error: errorText
                })
            }
        } catch (error) {
            logger.error(`Error extracting full frame image`, { error, fileKey })
            // Continue without full frame image
        }
    } catch (error) {
        logger.error("Error extracting comment images", { error, fileKey })
        // Don't throw - image extraction is optional, continue without images
    }

    return imageUrls
}

/**
 * Fetch comment from Figma API using a single integration
 */
export async function fetchFigmaCommentThreadFromApi(accessToken: string, fileKey: string, commentId: string): Promise<{ comment: FigmaApiComment; thread: FigmaApiComment[] } | null> {
    try {
        const commentsResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        if (!commentsResponse.ok) {
            const errorText = await commentsResponse.text()
            logger.error(`Failed to fetch comments for file ${fileKey}`, {
                error: errorText,
                fileKey
            })
            return null
        }

        const commentsData = await commentsResponse.json()
        const comments = (commentsData.comments || []) as FigmaApiComment[]

        if (!Array.isArray(comments) || comments.length === 0) {
            return null
        }

        const commentMap = new Map<string, FigmaApiComment>()
        for (const rawComment of comments) {
            commentMap.set(rawComment.id, rawComment)
        }

        const targetComment = commentMap.get(commentId)

        if (!targetComment) {
            return null
        }

        const findRootComment = (comment: FigmaApiComment): FigmaApiComment => {
            let current: FigmaApiComment = comment
            const visited = new Set<string>()

            while (current.parent_id) {
                if (visited.has(current.parent_id)) {
                    break
                }

                visited.add(current.parent_id)
                const parent = commentMap.get(current.parent_id)
                if (!parent) {
                    break
                }
                current = parent
            }

            return current
        }

        const rootComment = findRootComment(targetComment)
        const rootOrderId = rootComment.order_id || rootComment.id

        const threadComments = comments
            .filter(comment => {
                if (comment.id === rootComment.id) {
                    return true
                }

                // Prefer order_id when available (covers replies and nested replies)
                if (rootOrderId && comment.order_id) {
                    return comment.order_id === rootOrderId
                }

                // Fallback: walk up the parent chain to see if it reaches the root comment
                let current: FigmaApiComment | undefined = comment
                const visited = new Set<string>()
                while (current?.parent_id) {
                    if (visited.has(current.parent_id)) {
                        break
                    }
                    visited.add(current.parent_id)

                    if (current.parent_id === rootComment.id) {
                        return true
                    }

                    current = commentMap.get(current.parent_id)
                }

                return false
            })
            .sort((a, b) => {
                const aTime = new Date(a.created_at).getTime()
                const bTime = new Date(b.created_at).getTime()
                return aTime - bTime
            })

        const threadList = threadComments.length > 0 ? threadComments : [targetComment]

        return {
            comment: targetComment,
            thread: threadList
        }
    } catch (error) {
        logger.error(`⚠️  Error fetching comment from API with file key ${fileKey}`, { error, fileKey })
        return null
    }
}

export function findRootThreadComment(thread: FigmaApiComment[], fallback: FigmaApiComment): FigmaApiComment {
    if (thread.length === 0) {
        return fallback
    }

    const explicitRoot = thread.find(comment => !comment.parent_id)
    if (explicitRoot) {
        return explicitRoot
    }

    return thread[0] ?? fallback
}

export function resolvePositioningContext(
    targetComment: FigmaApiComment,
    thread: FigmaApiComment[]
): {
    rootComment: FigmaApiComment
    positioningComment: FigmaApiComment
    positioningData: FigmaPositioningData | null
} {
    const rootComment = findRootThreadComment(thread, targetComment)

    const orderedCandidates = [targetComment, ...thread.filter(comment => comment.id !== targetComment.id)]
    const candidateWithMeta = orderedCandidates.find(comment => comment.client_meta)
    const positioningComment = candidateWithMeta ?? (rootComment.client_meta ? rootComment : targetComment)

    const positioningData = parsePositioningData(positioningComment?.client_meta ?? null)

    return {
        rootComment,
        positioningComment,
        positioningData
    }
}

// MARK: - Types

/**
 * Figma webhook comment text object (from webhook payload)
 */
export interface FigmaWebhookCommentText {
    text: string
}

/**
 * Raw Figma webhook event payload
 * Generated from actual Figma webhook payload structure
 */
export interface FigmaWebhookEvent {
    event_type: string
    file_key: string
    file_name: string
    passcode: string
    protocol_version: string
    webhook_id: string
    timestamp: string
    retries: number
    // FILE_COMMENT specific fields
    comment_id: string
    comment: FigmaWebhookCommentText[]
    created_at: string
    resolved_at: string // Empty string if not resolved
    parent_id: string // Empty string if no parent
    order_id: string
    mentions: unknown[] // Array of mention objects (structure unknown)
    triggered_by: FigmaWebhookUser
}
