import { InputConfigType } from "@prisma/client"
import { LogLevel, TokensRevokedEvent, WebClient } from "@slack/web-api"
import { Reaction } from "@slack/web-api/dist/types/response/ChannelsHistoryResponse"
import { Channel as SlackChannel } from "@slack/web-api/dist/types/response/ConversationsInfoResponse"
import { User as SlackUser } from "@slack/web-api/dist/types/response/UsersInfoResponse"
import { Member as SlackUserMember } from "@slack/web-api/dist/types/response/UsersListResponse"
import axios from "axios"
import { Request, Response } from "express"
import { ConfigData, ConfigType, SlackAttachments, SlackBlocks, SlackConfigSchema, SlackEventType, SlackFile, SlackFiles, SlackMessage, SlackTrigger } from "terse-types"
import { ConfigurationFieldDefinition } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationType, SlackIntegration, SlackIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { OAuthInstallationDetails, SlackChannel as SlackChannelShared, SlackChannelType, SlackChannelsResponse, SlackUserResponse, SlackUsersResponse } from "terse-types/types"
import { z } from "zod"

import logger, { runWithUserContext } from "../../common/logger"
import { Identifiable } from "../../hydrators/Hydrator"
import { extractImagesFromMessage, pickSlackFileUrl } from "../../integrations/slack/blockKitHelpers"
import { getUserForOrg } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { mintOAuthState, verifyOAuthState } from "../../modules/auth/helpers/oauth"
import { KeyLimiter, RateLimiterClient } from "../../rateLimit/RateLimiterClient"
import { FileCategory, FileDownloadResult, StoredFile, buildSlackFileKey, ensureStoredWithMetadata, isSupportedFileType } from "../../services/FileStorageService"
import { GetSecretsArg, SecretService } from "../../services/SecretService"
import { urls } from "../../settings"
import { AgentTriggerWithConfigs, UserSlackIntegration, UserSlackIntegrationWithSlack } from "../../types/prisma"
import { IntegrationCompletedTask } from "../IntegrationCompletedTask"
import { integrationTaskQueue } from "../IntegrationTaskQueues"
import { FetchResourcesOptions } from "../abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"
import { TriggerRuntime } from "../abstract/TriggerRuntime"

import { initializeSlackWebClient, resolveSlackAccessToken } from "./client"

export class SlackIntegrationManager
    extends Integration<SlackIntegration, SimplifiedSlackEvent, typeof SlackIntegrationMetadata, SlackChannelShared | SlackUserResponse>
    implements OAuthIntegrationInstallation<IntegrationType.SLACK>
{
    readonly integrationType = IntegrationType.SLACK
    readonly settingsKey = "slack"
    readonly secretSchema = z.object({
        accessToken: z.string().optional(),
        authedUserAccessToken: z.string().optional()
    })

    async getInstancesForOrganization(organizationId: string): Promise<SlackIntegration[]> {
        const userSlackIntegrations = await db().user_slack_integrations.findMany({
            where: {
                organization_id: organizationId
            },
            include: {
                slack_integration: true
            }
        })
        return userSlackIntegrations.map(usi => ({
            id: usi.id,
            teamId: usi.slack_integration.team_id,
            teamName: usi.slack_integration.team_name,
            isBotUser: usi.is_bot_user
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integration = await db().user_slack_integrations.findFirst({
            where: { organization_id: organizationId },
            include: {
                slack_integration: true
            },
            orderBy: { created_at: "asc" }
        })

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Workspace", integration.slack_integration.team_name, integration.id)
    }

    async fetchResourcesForOrganization(
        organizationId: string,
        query?: string,
        options?: FetchResourcesOptions
    ): Promise<IntegrationWithResources<SlackIntegration, SlackChannelShared | SlackUserResponse>[]> {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const normalizedQuery = query?.trim().toLowerCase()
        const matchesQuery = (value: string | undefined | null): boolean => {
            if (!normalizedQuery) return true
            if (!value) return false
            return value.toLowerCase().includes(normalizedQuery)
        }
        const fetchUsers = options?.slack?.objectType === "users"
        return Promise.all(
            integrations.map(async integration => {
                const usi = await db().user_slack_integrations.findFirst({
                    where: {
                        id: integration.id,
                        organization_id: organizationId
                    },
                    select: { user_id: true }
                })
                if (!usi) {
                    return { integration, resources: [] }
                }
                try {
                    if (fetchUsers) {
                        const response = await fetchSlackUsersForIntegration(usi.user_id, organizationId, integration.id)
                        const users = normalizedQuery ? response.users.filter(u => matchesQuery(u.name)) : response.users
                        return { integration, resources: users }
                    }
                    const response = await fetchSlackChannelsForIntegration(usi.user_id, organizationId, integration.id)
                    const channels = normalizedQuery ? response.channels.filter(channel => matchesQuery(channel.name)) : response.channels
                    return { integration, resources: channels }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for Slack integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: SlackIntegration): string {
        const details: string[] = []
        if (instance.teamName) {
            details.push(`team "${instance.teamName}"`)
        }
        if (instance.teamId) {
            details.push(`teamId ${instance.teamId}`)
        }
        if (instance.isBotUser !== undefined) {
            details.push(instance.isBotUser ? "bot user" : "user token")
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Slack${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<SlackIntegration[]> {
        const userSlackIntegrations = await db().user_slack_integrations.findMany({
            include: {
                slack_integration: true
            }
        })
        return userSlackIntegrations.map(usi => ({
            id: usi.id,
            teamId: usi.slack_integration.team_id,
            teamName: usi.slack_integration.team_name,
            isBotUser: usi.is_bot_user
        }))
    }

    async processWebhookEvent(event: SimplifiedSlackEvent): Promise<void> {
        // For event_callback types, check if we've already processed this event
        const { team_id, event_id, type, authorizations } = event

        const prisma = db()

        if (type === "event_callback" && event_id) {
            const slackIntegration = await prisma.slack_integrations.findFirst({
                where: {
                    team_id: team_id
                }
            })

            if (slackIntegration) {
                // Try to mark this event as processed atomically
                // The unique constraint will prevent duplicate processing even in race conditions
                try {
                    await prisma.processed_slack_events.create({
                        data: {
                            slack_integration_id: slackIntegration.id,
                            event_id: event_id
                        }
                    })
                    logger.info(`✅ New event ${event_id} - processing...`, { event_id })
                } catch (error: any) {
                    // If unique constraint fails, this event was already processed
                    if (error.code === "P2002") {
                        logger.info(`⚠️  Skipping already processed event ${event_id}`, {
                            event_id
                        })
                        return // Already acknowledged above
                    }
                    // Re-throw other errors
                    throw error
                }
            }
        }

        // Process events asynchronously (already acknowledged to Slack)
        const eventData = event.event
        if (type === "event_callback" && eventData) {
            switch (eventData.type) {
                case "app_uninstalled":
                    await markWorkspaceUninstalled(team_id) // delete tokens, close queues
                    break
                case "tokens_revoked":
                    const tokensEvent = eventData as TokensRevokedEvent
                    if (tokensEvent.tokens.bot?.length) {
                        await markWorkspaceUninstalled(team_id)
                    } else {
                        await Promise.all((tokensEvent.tokens?.oauth ?? []).map(userId => deactivateToken(team_id, userId, false)))
                    }
                    break
                case "message":
                case "app_mention":
                    handleSlackMessageLikeEvent(event, team_id).catch(error => {
                        logger.error("Error processing Slack message in background", {
                            error
                        })
                    })
                    break
                case "reaction_added":
                    handleSlackReactionAdded(event, team_id).catch(error => {
                        logger.error("Error processing Slack reaction in background", {
                            error
                        })
                    })
                    break
            }
        } else if (type === "app_uninstalled") {
            await markWorkspaceUninstalled(team_id)
        } else if (type === "tokens_revoked") {
            const tokensEvent = event as TokensRevokedEvent
            if (tokensEvent.tokens.bot?.length) {
                await markWorkspaceUninstalled(team_id)
            } else {
                await Promise.all((tokensEvent.tokens?.oauth ?? []).map(userId => deactivateToken(team_id, userId, false)))
            }
        }
    }

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return [
            {
                name: "isBotUser",
                type: "radio",
                label: "User Type",
                required: true,
                options: [
                    { label: "Bot User", value: "true" },
                    { label: "Regular User", value: "false" }
                ],
                hint: "Choose whether you want to connect as a bot user or a regular user."
            }
        ]
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<IntegrationType.SLACK>,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        const client_id = this.config.clientId
        const redirect_uri = this.config.oauthCallbackUrl
        const isBotUser = options.isBotUser
        const scope = "channels:history,groups:history,im:history,channels:read,groups:read,im:read,users:read,chat:write,im:write,app_mentions:read,reactions:read,reactions:write,files:read"
        const user_scope = isBotUser
            ? ""
            : "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,chat:write,im:write,reactions:read,reactions:write,files:read"
        const state = mintOAuthState(req, res, {
            userId,
            organizationId,
            additionalFields: { isBotUser },
            additionalStatePayload,
            encodeAsUriComponent: true
        })

        const encodedRedirectUri = encodeURIComponent(redirect_uri)
        const url = `https://slack.com/oauth/v2/authorize?scope=${scope}&user_scope=${user_scope}&redirect_uri=${encodedRedirectUri}&client_id=${client_id}&state=${state}`

        return {
            oauthUrl: url
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const frontendUrl = urls.frontend

        // Check if Slack returned an error (user denied access, etc.)
        if (req.query.error) {
            logger.error("Slack OAuth error", { error: String(req.query.error) })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        // grab temporary code from query
        const code = req.query.code as string
        const state = req.query.state as string

        if (!code || !state) {
            logger.error("Missing code or state in OAuth callback")
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        let decoded: any
        try {
            decoded = verifyOAuthState(req, res, state)
        } catch (error) {
            logger.error("Invalid OAuth state — rejecting Slack callback", { error })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }
        const organizationId = decoded.organizationId

        if (!organizationId || typeof organizationId !== "string") {
            logger.error("Slack OAuth: organizationId is required in state", {
                userId: decoded.userId
            })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        const client_id = this.config.clientId
        const client_secret = this.config.clientSecret
        const redirect_uri = this.config.oauthCallbackUrl

        try {
            const response = await axios.post<SlackOAuthResponse>(
                "https://slack.com/api/oauth.v2.access",
                {
                    code: code,
                    client_id: client_id,
                    client_secret: client_secret,
                    redirect_uri: redirect_uri
                },
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            )

            logger.debug("Slack OAuth response", {
                ok: response.data.ok,
                teamId: response.data.team?.id,
                appId: response.data.app_id,
                botUserId: response.data.bot_user_id,
                authedUserId: response.data.authed_user?.id,
                authedUserTokenType: response.data.authed_user?.token_type,
                hasAccessToken: Boolean(response.data.access_token),
                hasAuthedUserAccessToken: Boolean(response.data.authed_user?.access_token)
            })

            const { access_token, authed_user, team } = response.data

            if (!response.data.ok || !team || !team.id) {
                logger.error("Slack OAuth response not ok", {
                    ok: response.data.ok,
                    error: response.data.error,
                    hasTeam: Boolean(response.data.team),
                    teamId: response.data.team?.id
                })
                res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // check if the slack integration already exists
            let slackIntegration = await db().slack_integrations.findFirst({
                where: {
                    team_id: team.id
                }
            })

            // Calculate isUserType outside transaction so we can use it later
            const tokenType = authed_user?.token_type
            const isUserType = tokenType === AuthedUserTokenType.user
            let userSlackIntegrationId: string | null = null

            await db().$transaction(async tx => {
                if (slackIntegration) {
                    logger.info("Slack integration already exists, continuing with adding user relation", { teamId: team.id })
                    // Update existing integration with user_scope
                    await tx.slack_integrations.update({
                        where: {
                            team_id: slackIntegration.team_id
                        },
                        data: {
                            app_id: response.data.app_id,
                            bot_user_id: response.data.bot_user_id,
                            team_id: response.data.team.id,
                            team_name: response.data.team.name
                        }
                    })
                } else {
                    logger.info("Slack integration does not exist, creating it", {
                        teamId: team.id,
                        teamName: team.name
                    })
                    slackIntegration = await tx.slack_integrations.create({
                        data: {
                            app_id: response.data.app_id,
                            bot_user_id: response.data.bot_user_id,
                            team_id: response.data.team.id,
                            team_name: response.data.team.name
                        }
                    })
                    logger.info("Slack integration created", {
                        teamId: team.id,
                        teamName: team.name
                    })
                }

                const dmChannelId = await this.openChat(access_token, authed_user.id)

                if (!dmChannelId || !dmChannelId.id) {
                    logger.error("Error opening chat", { authedUserId: authed_user.id })
                    throw new Error("Failed to open chat")
                }

                const updatePayload: Partial<UserSlackIntegration> = isUserType
                    ? {
                          authed_user_id: authed_user.id,
                          organization_id: organizationId
                      }
                    : {
                          authed_user_id: authed_user.id,
                          organization_id: organizationId
                      }

                const createData =
                    isUserType && authed_user.access_token
                        ? {
                              user_id: decoded.userId,
                              slack_team_id: slackIntegration.team_id,
                              authed_user_id: authed_user.id,
                              is_bot_user: false,
                              organization_id: organizationId
                          }
                        : {
                              user_id: decoded.userId,
                              slack_team_id: slackIntegration.team_id,
                              authed_user_id: authed_user.id,
                              is_bot_user: true,
                              organization_id: organizationId
                          }

                const upsertedUserSlackIntegration = await tx.user_slack_integrations.upsert({
                    where: {
                        user_id_slack_team_id_is_bot_user: {
                            user_id: decoded.userId,
                            slack_team_id: slackIntegration.team_id,
                            is_bot_user: !isUserType
                        }
                    },
                    update: {
                        ...updatePayload
                    },
                    create: createData
                })

                userSlackIntegrationId = upsertedUserSlackIntegration.id
            })

            if (!slackIntegration) {
                logger.error("Failed to resolve slack integration after OAuth", {
                    userId: decoded.userId,
                    teamId: team.id
                })
                res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: slackIntegration.id, value: { accessToken: access_token } } })

            if (isUserType && authed_user.access_token && userSlackIntegrationId) {
                await this.secretService.createSecrets({
                    type: "integration",
                    secret: { integrationType: IntegrationType.SLACK, recordId: userSlackIntegrationId, value: { authedUserAccessToken: authed_user.access_token } }
                })
            }

            const userSlackIntegration = userSlackIntegrationId
                ? await db().user_slack_integrations.findUnique({
                      where: { id: userSlackIntegrationId }
                  })
                : null

            if (!userSlackIntegration) {
                logger.error("Failed to find user_slack_integration after OAuth", {
                    userId: decoded.userId,
                    teamId: team.id
                })
                res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.SLACK, userSlackIntegration.id, decoded.userId, decoded, new Date()))

            logger.info("Slack OAuth completed successfully", {
                userId: decoded.userId,
                teamId: team.id,
                integrationId: userSlackIntegration.id
            })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error exchanging code for access token", { error })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    private async openChat(accessToken: string, authedUserId: string) {
        try {
            const client = new WebClient(accessToken, {
                logLevel: LogLevel.WARN
            })

            const { channel } = await client.conversations.open({
                users: authedUserId
            })

            return channel
        } catch (error) {
            logger.error("Error opening chat", { error, authedUserId })
            return null
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        const existing = await db().user_slack_integrations.findUnique({
            where: { id: integrationId },
            include: { slack_integration: true }
        })

        if (!existing) {
            return
        }

        const otherConnections = await db().user_slack_integrations.count({
            where: { slack_team_id: existing.slack_team_id, NOT: { id: integrationId } }
        })
        const isLastConnection = otherConnections === 0
        const slackIntegrationId = existing.slack_integration?.id ?? null

        const tokensToRevoke: string[] = []
        try {
            const userSecrets = await this.secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: integrationId } })
            if (userSecrets?.authedUserAccessToken) tokensToRevoke.push(userSecrets.authedUserAccessToken)
        } catch (error) {
            logger.warn("Failed to load Slack user secrets during disconnect; skipping user token revoke", { error, integrationId })
        }

        if (isLastConnection && slackIntegrationId) {
            try {
                const workspaceSecrets = await this.secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: slackIntegrationId } })
                if (workspaceSecrets?.accessToken) tokensToRevoke.push(workspaceSecrets.accessToken)
            } catch (error) {
                logger.warn("Failed to load Slack workspace secrets during disconnect; skipping bot token revoke", { error, integrationId, slackIntegrationId })
            }
        }

        for (const token of tokensToRevoke) {
            try {
                const response = await fetch("https://slack.com/api/auth.revoke", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                })
                const body = (await response.json().catch(() => null)) as { ok?: boolean; revoked?: boolean; error?: string } | null
                if (body?.ok && body.revoked) {
                    logger.info("Revoked Slack token", { integrationId })
                } else {
                    logger.warn("Slack auth.revoke returned non-OK", { status: response.status, body, integrationId })
                }
            } catch (error) {
                logger.warn("Failed to revoke Slack token on disconnect", { error, integrationId })
            }
        }

        const userSlackIntegration = await db().$transaction(async tx => {
            const row = await tx.user_slack_integrations.findUnique({
                where: { id: integrationId },
                include: { slack_integration: true }
            })

            if (!row) {
                return null
            }

            await tx.user_slack_integrations.delete({ where: { id: integrationId } })

            const remainingConnections = await tx.user_slack_integrations.count({
                where: { slack_team_id: row.slack_team_id }
            })

            if (remainingConnections === 0) {
                await tx.slack_integrations.delete({ where: { team_id: row.slack_team_id } })
            }

            return row
        })

        if (!userSlackIntegration) {
            return
        }

        const queries: GetSecretsArg[] = [{ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: integrationId } }]
        if (isLastConnection && slackIntegrationId) {
            queries.push({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: slackIntegrationId } })
        }
        await this.secretService.deleteSecrets(queries)
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Slack doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Slack doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        // Slack uses app-level tokens that are long-lived and don't require refresh
        // Return false to indicate no refresh was needed/performed
        return false
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            // Slack integrationId is the user_slack_integrations.id
            // We need to get the associated slack_integration to access the token
            const userSlackIntegration = await db().user_slack_integrations.findUnique({
                where: { id: integrationId },
                include: {
                    slack_integration: true
                }
            })

            if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
                logger.error(`Slack integration ${integrationId} not found`, {
                    integrationId
                })
                return null
            }

            return await resolveSlackAccessToken(userSlackIntegration)
        } catch (error) {
            logger.error(`Error getting Slack access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, _userId: string, triggerConfig: ConfigData, options?: { limit?: number }): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.SLACK) {
            return []
        }
        const slackConfig = SlackConfigSchema.parse(triggerConfig)

        const limit = Math.min(options?.limit ?? 5, 10)
        const prisma = db()

        const userSlackIntegration = await prisma.user_slack_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId },
            include: { slack_integration: true }
        })

        if (!userSlackIntegration?.slack_integration) {
            throw new Error(`Slack integration ${integrationId} not found`)
        }

        // Use user token for DMs when available (user's DMs), otherwise bot token (bot's DMs). Same for channels: bot token.
        const token = await getSlackToken(userSlackIntegration)
        if (!token) {
            throw new Error(`Slack access token not found for integration ${integrationId}. Please reconnect your Slack workspace.`)
        }

        const client = new WebClient(token, { logLevel: LogLevel.ERROR })
        const teamId = userSlackIntegration.slack_integration.team_id
        const selectedEventTypes = slackConfig.eventTypes ?? []
        const supportsMessageSamples = selectedEventTypes.includes(SlackEventType.MESSAGE) || selectedEventTypes.includes(SlackEventType.APP_MENTION)
        if (!supportsMessageSamples) {
            return []
        }

        let messages: SlackMessageLookup[] = []

        if (slackConfig.listenToUserDms) {
            const imList = await client.conversations.list({
                types: "im",
                limit: 20,
                exclude_archived: true
            })
            if (!imList.ok || !imList.channels?.length) {
                return []
            }
            for (const im of imList.channels.slice(0, 3)) {
                if (!im.id) continue
                const history = await client.conversations.history({
                    channel: im.id,
                    limit: Math.ceil(limit / 2)
                })
                if (history.ok && history.messages?.length) {
                    for (const msg of history.messages) {
                        if (msg.ts && msg.user) {
                            messages.push({
                                channel: im.id,
                                ts: msg.ts,
                                user: msg.user,
                                text: msg.text,
                                thread_ts: msg.thread_ts,
                                channel_type: SlackChannelType.IM,
                                blocks: msg.blocks,
                                attachments: msg.attachments,
                                files: msg.files
                            })
                        }
                    }
                }
            }
            messages = messages.sort((a, b) => (b.ts > a.ts ? 1 : -1)).slice(0, limit)
        } else if (slackConfig.channelId) {
            const history = await client.conversations.history({
                channel: slackConfig.channelId,
                limit
            })
            if (!history.ok || !history.messages?.length) {
                return []
            }
            for (const msg of history.messages) {
                if (msg.ts && msg.user) {
                    messages.push({
                        channel: slackConfig.channelId,
                        ts: msg.ts,
                        user: msg.user,
                        text: msg.text,
                        thread_ts: msg.thread_ts,
                        channel_type: undefined,
                        blocks: msg.blocks,
                        attachments: msg.attachments,
                        files: msg.files
                    })
                }
            }
        } else {
            return []
        }

        const events: TriggerRuntime[] = []
        for (const msg of messages) {
            const enrichedMessage = await fetchEnrichedSlackMessageData(client, msg)
            const inferredEventType = selectedEventTypes.includes(SlackEventType.APP_MENTION) && enrichedMessage.text.includes("<@") ? SlackEventType.APP_MENTION : SlackEventType.MESSAGE
            if (!selectedEventTypes.includes(inferredEventType)) {
                continue
            }

            const slackEventData = buildSlackTriggerData({
                eventType: inferredEventType,
                channelId: msg.channel,
                channelName: enrichedMessage.channelName || null,
                userId: msg.user,
                userName: enrichedMessage.userName || null,
                text: enrichedMessage.text,
                timestamp: msg.ts,
                threadTimestamp: msg.thread_ts || null,
                teamId,
                permalink: enrichedMessage.permalink || null,
                channelType: inferSlackChannelType(msg.channel, msg.channel_type || null),
                blocks: enrichedMessage.blocks || null,
                attachments: enrichedMessage.attachments || null,
                files: enrichedMessage.files || null
            })
            events.push(new SlackTriggerRuntime(slackEventData, integrationId))
        }
        return events
    }
}

// MARK: - Slack Channel Fetching

type SlackRouteError = Error & {
    statusCode?: number
    details?: string
    code?: string
}

function createSlackRouteError(message: string, statusCode: number, details?: string, code?: string): SlackRouteError {
    const error = new Error(message) as SlackRouteError
    error.statusCode = statusCode
    error.details = details
    error.code = code
    return error
}

const getSlackToken = async (integration: UserSlackIntegrationWithSlack) => {
    return await resolveSlackAccessToken(integration)
}

/**
 * Fetches Slack channels for an integration.
 * Moved here from modules/integrations/slack/controller.ts to avoid circular dependency.
 */
export const fetchSlackChannelsForIntegration = async (userId: string, organizationId: string, integrationId: string): Promise<SlackChannelsResponse> => {
    if (!integrationId) {
        throw createSlackRouteError("integrationId is required", 400)
    }
    if (!organizationId) {
        throw createSlackRouteError("Organization context is required", 400)
    }

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: integrationId,
            organization_id: organizationId
        },
        include: {
            slack_integration: true
        }
    })

    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
        throw createSlackRouteError("Slack integration not found", 404)
    }
    const token = await getSlackToken(userSlackIntegration)
    if (!token) {
        throw createSlackRouteError("Slack access token not found", 401, "The Slack integration token is missing. Please reconnect.", "SLACK_TOKEN_MISSING")
    }
    const isBotUser = userSlackIntegration.is_bot_user
    const teamName = userSlackIntegration.slack_integration.team_name
    const authedUserId = userSlackIntegration.authed_user_id
    const teamId = userSlackIntegration.slack_team_id

    logger.debug(`🔵 [SLACK CHANNELS] integration: team="${teamName}", user_id="${authedUserId}", team_id="${teamId}"`, { teamName, authedUserId, teamId, integrationId })

    const client = new WebClient(token, {
        logLevel: LogLevel.ERROR
    })

    try {
        const [publicChannels, privateChannels, mpimChannels] = await Promise.all([
            client.conversations.list({
                types: "public_channel",
                exclude_archived: true,
                limit: 1000
            }),
            client.conversations.list({
                types: "private_channel",
                exclude_archived: true,
                limit: 1000
            }),
            client.conversations.list({
                types: "mpim",
                exclude_archived: true,
                limit: 1000
            })
        ])

        const channels: SlackChannelShared[] = []

        if (publicChannels.ok && publicChannels.channels) {
            for (const channel of publicChannels.channels) {
                if (channel.id && channel.name && (!isBotUser || channel.is_member)) {
                    channels.push({
                        id: channel.id,
                        name: channel.name,
                        isPrivate: false,
                        isArchived: channel.is_archived || false,
                        isMPIM: false
                    })
                }
            }
        }

        if (privateChannels.ok && privateChannels.channels) {
            for (const channel of privateChannels.channels) {
                if (channel.id && channel.name) {
                    channels.push({
                        id: channel.id,
                        name: channel.name,
                        isPrivate: true,
                        isArchived: channel.is_archived || false,
                        isMPIM: false
                    })
                }
            }
        }

        if (mpimChannels.ok && mpimChannels.channels) {
            for (const channel of mpimChannels.channels) {
                if (channel.id && channel.name) {
                    channels.push({
                        id: channel.id,
                        name: channel.name,
                        isPrivate: true,
                        isArchived: channel.is_archived || false,
                        isMPIM: true
                    })
                }
            }
        }

        channels.sort((a, b) => a.name.localeCompare(b.name))

        return {
            channels,
            selectedChannelId: null
        }
    } catch (error: any) {
        logger.error("Error fetching Slack channels", {
            error,
            integrationId,
            userId
        })

        const isInvalidAuth = error?.data?.error === "invalid_auth" || (error?.code === "slack_webapi_platform_error" && error?.data?.error === "invalid_auth")

        if (isInvalidAuth) {
            throw createSlackRouteError("Slack authentication failed", 401, "The Slack integration token is invalid or expired. Please reconnect your Slack integration.", "SLACK_INVALID_AUTH")
        }

        throw createSlackRouteError("Failed to fetch channels", 500, error.message)
    }
}

/**
 * Fetches Slack workspace users for an integration.
 * Used by the route and by fetchResourcesForOrganization when options.slack.objectType === "users".
 */
export const fetchSlackUsersForIntegration = async (userId: string, organizationId: string, integrationId: string): Promise<SlackUsersResponse> => {
    if (!integrationId) {
        throw createSlackRouteError("integrationId is required", 400)
    }
    if (!organizationId) {
        throw createSlackRouteError("Organization context is required", 400)
    }
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: integrationId,
            organization_id: organizationId
        },
        include: {
            slack_integration: true
        }
    })
    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
        throw createSlackRouteError("Slack integration not found", 404)
    }

    const token = await getSlackToken(userSlackIntegration)
    if (!token) {
        throw createSlackRouteError("Slack access token not found", 401, "The Slack integration token is missing. Please reconnect.", "SLACK_TOKEN_MISSING")
    }
    const client = new WebClient(token, {
        logLevel: LogLevel.ERROR
    })

    let cursor: string | undefined
    const users: SlackUserResponse[] = []
    do {
        const res = await client.users.list({ limit: 200, cursor })
        if (!res.ok) {
            throw createSlackRouteError("Failed to fetch users", 500)
        }
        if (!res.members || res.members.length === 0) {
            break
        }
        const userSegment = res.members
            .filter((member): member is SlackUserMember & { id: string; name: string } => Boolean(member.id && member.name) && !member.is_bot)
            .map(member => ({
                id: member.id,
                name: member.name
            }))
        users.push(...userSegment)
        cursor = res.response_metadata?.next_cursor
    } while (cursor)

    return { users }
}

// MARK: - SLACK Event

export class SlackTriggerRuntime extends TriggerRuntime<SlackTrigger> implements Identifiable {
    readonly integrationType = IntegrationType.SLACK
    data: SlackTrigger
    readonly entityType = "slack_message_event"
    entityId: string
    private storedFiles: StoredFile[]
    readonly integrationId: string

    constructor(data: SlackTrigger, integrationId: string, storedFiles: StoredFile[] = []) {
        super()
        this.data = data
        this.integrationId = integrationId
        this.entityId = `${data.teamId}:${data.permalink || ""}`
        this.storedFiles = storedFiles
    }

    /**
     * Get all stored files with full metadata (images, documents)
     * Includes both private files cached in GCS and public block/attachment images
     */
    getFiles(): StoredFile[] {
        const files: StoredFile[] = [...(this.storedFiles || [])]
        const publicImages = extractImagesFromMessage(this.data).filter(img => !img.requiresAuth)
        for (const img of publicImages) {
            files.push({
                url: img.url,
                mimeType: "image/png",
                category: FileCategory.IMAGE
            })
        }
        return files
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.SLACK) {
            return false
        }

        if (agentTrigger.integration_id !== this.integrationId) {
            return false
        }

        const slackConfig = agentTrigger.slack_config
        if (!slackConfig) {
            return false
        }
        if (slackConfig.event_types && slackConfig.event_types.length > 0 && !slackConfig.event_types.includes(this.data.eventType)) {
            return false
        }

        const isChannelOrGroup = this.data.channelType === SlackChannelType.CHANNEL || this.data.channelType === SlackChannelType.GROUP || this.data.channelType === SlackChannelType.MPIM
        const isDM = this.data.channelType === SlackChannelType.IM

        // Helper function to check if user matches filter (if userIds is specified)
        const matchesUserFilter = !slackConfig.user_ids || slackConfig.user_ids.length === 0 || slackConfig.user_ids.includes(this.data.userId)

        const matchesChannelOrGroup = isChannelOrGroup && this.data.channelId === slackConfig.channel_id && matchesUserFilter
        const matchesDM = isDM && slackConfig?.listen_to_user_dms && matchesUserFilter
        return matchesChannelOrGroup || matchesDM
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: this.data.eventType,
            integration: IntegrationType.SLACK,
            source: this.data.channelName || this.data.channelId,
            title: this.data.text.substring(0, 100) || this.data.eventType,
            subheader: this.data.userName || this.data.userId,
            url: this.data.permalink || undefined
        }
    }
}

async function markWorkspaceUninstalled(team_id: string) {
    logger.info("Workspace uninstalled. Deleting records from database...", {
        teamId: team_id
    })

    // Fetch IDs before deleting so we can clean up GSM secrets afterward
    const [userSlackIntegrations, slackIntegrations] = await Promise.all([
        db().user_slack_integrations.findMany({
            where: { slack_team_id: team_id },
            select: { id: true }
        }),
        db().slack_integrations.findMany({
            where: { team_id: team_id },
            select: { id: true }
        })
    ])

    // DB-first
    await db().$transaction(async tx => {
        await tx.user_slack_integrations.deleteMany({
            where: { slack_team_id: team_id }
        })
        await tx.slack_integrations.deleteMany({
            where: { team_id: team_id }
        })
    })

    const secretService = SecretService.getInstance()

    // Best-effort GSM cleanup
    await secretService.deleteSecrets([
        ...slackIntegrations.map<GetSecretsArg>(i => ({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: i.id } })),
        ...userSlackIntegrations.map<GetSecretsArg>(i => ({ type: "integration", secret: { integrationType: IntegrationType.SLACK, recordId: i.id } }))
    ])

    logger.info("Workspace uninstalled. Records deleted from database.", {
        teamId: team_id
    })
}

async function deactivateToken(teamId: string, authedUserId: string, isBotUser: boolean) {
    const matches = await db().user_slack_integrations.findMany({
        where: {
            slack_team_id: teamId,
            authed_user_id: authedUserId,
            is_bot_user: isBotUser
        },
        select: { id: true }
    })

    if (matches.length === 0) {
        logger.info("tokens_revoked: no matching user_slack_integrations row to deactivate", {
            teamId,
            authedUserId,
            isBotUser
        })
        return
    }

    await db().user_slack_integrations.deleteMany({
        where: {
            id: { in: matches.map(m => m.id) }
        }
    })

    const secretService = SecretService.getInstance()
    await secretService.deleteSecrets(
        matches.map<GetSecretsArg>(m => ({
            type: "integration",
            secret: { integrationType: IntegrationType.SLACK, recordId: m.id }
        }))
    )

    logger.info("tokens_revoked: deactivated Slack user integration(s)", {
        teamId,
        authedUserId,
        isBotUser,
        deletedCount: matches.length
    })
}

/**
 * Helper function to process Promise.allSettled results from Slack API calls
 * Handles fulfilled+ok, rejected, and fulfilled but not ok states
 */
enum PromiseSettledStatus {
    FULFILLED = "fulfilled",
    REJECTED = "rejected"
}

function processSlackApiResult<T>(result: SlackApiSettledResult<T>, successLabel: string, errorPrefix: string): { success: boolean; data?: T; error?: string } {
    if (result.status === PromiseSettledStatus.FULFILLED && result.value.ok) {
        // Successfully fulfilled and ok
        const { ok, error, ...data } = result.value
        return { success: true, data: data as T }
    } else if (result.status === PromiseSettledStatus.REJECTED) {
        // Promise was rejected
        logger.warn(`⚠ ${errorPrefix}: ${result.reason}`, {
            reason: String(result.reason)
        })
        return { success: false, error: String(result.reason) }
    } else if (result.status === PromiseSettledStatus.FULFILLED && !result.value.ok) {
        // Fulfilled but API returned error
        const errorMsg = result.value.error || "Unknown error"
        logger.warn(`⚠ ${errorPrefix}: ${errorMsg}`, { error: errorMsg })
        return { success: false, error: errorMsg }
    }
    return { success: false, error: "Unknown state" }
}

/**
 * Extract channel name from Slack channel info, handling different channel types
 */
function extractChannelName(
    channelResult: {
        success: boolean
        data?: { channel?: SlackChannel }
        error?: string
    },
    userResult: { success: boolean; data?: { user?: SlackUser }; error?: string },
    eventUserId: string,
    defaultChannelId: string
): string | undefined {
    if (!channelResult.success || !channelResult.data?.channel) {
        return undefined
    }

    const channel = channelResult.data.channel

    // Handle different channel types
    if ("name" in channel && channel.name) {
        // Public/private channel
        const channelName = channel.name
        logger.debug(`✓ Fetched channel name: ${channelName}`, {
            channelName,
            channelId: channel.id
        })
        return channelName
    } else if ("is_im" in channel && channel.is_im) {
        // Direct message - try to get user info from the channel user ID
        const dmUserId = "user" in channel ? channel.user : undefined
        let channelName: string | undefined

        if (dmUserId && userResult.success && userResult.data?.user) {
            const user = userResult.data.user
            if (user && dmUserId === eventUserId) {
                // This is a DM with the message sender - use their name
                channelName = user.real_name || user.profile?.display_name || user.name || "Direct Message"
            }
        }

        if (!channelName) {
            channelName = "Direct Message"
        }
        logger.debug(`✓ Identified channel as DM: ${channelName}`, {
            channelName,
            channelId: channel.id
        })
        return channelName
    } else if ("is_group" in channel && channel.is_group) {
        // Group DM
        const channelName = "name" in channel && channel.name ? channel.name : "Group Message"
        logger.debug(`✓ Identified channel as Group DM: ${channelName}`, {
            channelName,
            channelId: channel.id
        })
        return channelName
    } else {
        // Fallback to channel ID
        const channelName = channel.id || defaultChannelId
        logger.warn(`⚠ Using channel ID as name: ${channelName}`, {
            channelName,
            channelId: channel.id
        })
        return channelName
    }
}

/**
 * Extract user name from Slack user info
 */
function extractUserName(userResult: { success: boolean; data?: { user?: SlackUser }; error?: string }): string | undefined {
    if (!userResult.success || !userResult.data?.user) {
        return undefined
    }

    const user = userResult.data.user
    // Prefer real_name, fallback to display_name, then name, then id
    const userName = user.real_name || user.profile?.display_name || user.profile?.real_name || user.name || user.id
    logger.debug(`✓ Fetched user name: ${userName}`, {
        userName,
        userId: user.id
    })
    return userName
}

type SlackMessageLookup = Pick<SlackMessage, "text" | "thread_ts" | "blocks" | "attachments" | "files"> & {
    channel: string
    user: string
    ts: string
    channel_type?: SlackChannelType
}

type EnrichedSlackMessageData = {
    channelName?: string
    userName?: string
    permalink?: string
    text: string
    blocks?: SlackBlocks
    attachments?: SlackAttachments
    files?: SlackFiles
}

async function fetchEnrichedSlackMessageData(client: WebClient, message: SlackMessageLookup): Promise<EnrichedSlackMessageData> {
    const [channelInfo, userInfo, permalinkResult, fullMessageResult] = await Promise.allSettled([
        client.conversations.info({
            channel: message.channel
        }),
        client.users.info({
            user: message.user
        }),
        client.chat.getPermalink({
            channel: message.channel,
            message_ts: message.ts
        }),
        client.conversations.history({
            channel: message.channel,
            oldest: message.ts,
            latest: message.ts,
            inclusive: true,
            limit: 1
        })
    ])

    const channelResult = processSlackApiResult<{ channel?: SlackChannel }>(channelInfo as SlackApiSettledResult<{ channel?: SlackChannel }>, "Channel info", "Failed to fetch channel info")
    const userResult = processSlackApiResult<{ user?: SlackUser }>(userInfo as SlackApiSettledResult<{ user?: SlackUser }>, "User info", "Failed to fetch user info")
    const permalinkApiResult = processSlackApiResult<{ permalink?: string }>(permalinkResult as SlackApiSettledResult<{ permalink?: string }>, "Message permalink", "Failed to fetch message permalink")

    const channelName = extractChannelName(channelResult, userResult, message.user, message.channel)
    const userName = extractUserName(userResult)
    const permalink = permalinkApiResult.success ? permalinkApiResult.data?.permalink : undefined

    if (permalink) {
        logger.debug(`✓ Fetched message permalink: ${permalink}`, {
            permalink,
            channel: message.channel,
            messageTs: message.ts
        })
    }

    let blocks = message.blocks
    let attachments = message.attachments
    let files = message.files
    let text = message.text || ""

    if (fullMessageResult.status === PromiseSettledStatus.FULFILLED && fullMessageResult.value.ok && fullMessageResult.value.messages?.[0]) {
        const fullMessage = fullMessageResult.value.messages[0]

        if (!blocks && fullMessage.blocks) {
            blocks = fullMessage.blocks
            logger.debug(`✓ Extracted blocks from full message API (${blocks.length} blocks)`, { channel: message.channel, messageTs: message.ts })
        }
        if (!attachments && fullMessage.attachments) {
            attachments = fullMessage.attachments
            logger.debug(`✓ Extracted attachments from full message API (${attachments.length} attachments)`, { channel: message.channel, messageTs: message.ts })
        }
        if (!files && fullMessage.files) {
            files = fullMessage.files
            logger.debug(`✓ Extracted files from full message API (${files.length} files)`, { channel: message.channel, messageTs: message.ts })
        }
        if (!text && fullMessage.text) {
            text = fullMessage.text
            logger.debug("✓ Extracted text from full message API", {
                channel: message.channel,
                messageTs: message.ts
            })
        }
    }

    return {
        channelName,
        userName,
        permalink,
        text,
        blocks,
        attachments,
        files
    }
}

function getSlackErrorCode(error: unknown): string | undefined {
    const data = (error as { data?: { error?: unknown } } | undefined)?.data
    return typeof data?.error === "string" ? data.error : undefined
}

const EXPECTED_NOT_IN_CHANNEL_ERRORS = new Set(["channel_not_found", "not_in_channel", "is_archived", "missing_scope"])

function isExpectedNotInChannelError(error: unknown): boolean {
    const code = getSlackErrorCode(error)
    return code !== undefined && EXPECTED_NOT_IN_CHANNEL_ERRORS.has(code)
}

function inferSlackChannelType(channelId: string, fallback?: SlackChannelType | null): SlackChannelType | null {
    if (fallback) {
        return fallback
    }
    const prefix = channelId.charAt(0).toUpperCase()
    if (prefix === "D") return SlackChannelType.IM
    if (prefix === "G") return SlackChannelType.GROUP
    if (prefix === "C") return SlackChannelType.CHANNEL
    return null
}

function buildSlackTriggerData(params: {
    eventType: SlackEventType
    channelId: string
    channelName?: string | null
    userId: string
    userName?: string | null
    text: string
    timestamp: string
    threadTimestamp?: string | null
    teamId: string
    permalink?: string | null
    channelType?: SlackChannelType | null
    blocks?: SlackBlocks | null
    attachments?: SlackAttachments | null
    files?: SlackFiles | null
    reaction?: string | null
    itemType?: string | null
    itemUserId?: string | null
    itemChannelId?: string | null
    itemTimestamp?: string | null
}): SlackTrigger {
    const commonFields = {
        integrationType: IntegrationType.SLACK as const,
        channelId: params.channelId,
        channelName: params.channelName || null,
        userId: params.userId,
        userName: params.userName || null,
        text: params.text,
        timestamp: params.timestamp,
        threadTimestamp: params.threadTimestamp || null,
        teamId: params.teamId,
        permalink: params.permalink || null,
        channelType: params.channelType || null,
        blocks: params.blocks || null,
        attachments: params.attachments || null,
        files: params.files || null
    }

    if (params.eventType === SlackEventType.REACTION_ADDED) {
        return {
            ...commonFields,
            eventType: SlackEventType.REACTION_ADDED,
            reaction: params.reaction || "unknown",
            itemType: params.itemType || null,
            itemUserId: params.itemUserId || null,
            itemChannelId: params.itemChannelId || null,
            itemTimestamp: params.itemTimestamp || null
        }
    }

    return {
        ...commonFields,
        eventType: params.eventType
    }
}

async function getFilteredWorkspaceUserIntegrations(teamId: string, channelId: string, channelType: SlackChannelType | null): Promise<UserSlackIntegrationWithSlack[]> {
    const workspaceUserIntegrations = await db().user_slack_integrations.findMany({
        where: {
            slack_team_id: teamId
        },
        include: {
            slack_integration: true
        }
    })

    const resolvedChannelType = inferSlackChannelType(channelId, channelType)
    const isPublicChannel = resolvedChannelType === SlackChannelType.CHANNEL

    const isInChannel = async (integration: UserSlackIntegrationWithSlack) => {
        try {
            const botClient = await initializeSlackWebClient(integration)

            let membersRes: Awaited<ReturnType<typeof botClient.conversations.members>> | undefined
            try {
                membersRes = await botClient.conversations.members({
                    channel: channelId
                })
            } catch (error) {
                if (isExpectedNotInChannelError(error)) {
                    logger.debug("conversations.members says user not in channel", {
                        error: getSlackErrorCode(error),
                        channel: channelId,
                        teamId
                    })
                    return false
                }
                logger.error(`Error getting members`, {
                    error,
                    channel: channelId,
                    teamId
                })
                return false
            }

            if (membersRes.ok && membersRes.members && membersRes.members.length > 0) {
                const channelMemberIds = membersRes.members
                return channelMemberIds.includes(integration.authed_user_id) || channelMemberIds.includes(integration.slack_integration.bot_user_id)
            } else {
                const errorMsg = membersRes.error || (membersRes.members?.length === 0 ? "no members" : "unknown error")
                logger.warn(`⚠ Could not get members - ${errorMsg}`, {
                    error: errorMsg,
                    channel: channelId,
                    teamId
                })
                return false
            }
        } catch (error) {
            if (isExpectedNotInChannelError(error)) {
                logger.debug("conversations.members says user not in channel", {
                    error: getSlackErrorCode(error),
                    channel: channelId,
                    teamId
                })
                return false
            }
            logger.error(`Error getting members`, {
                error,
                channel: channelId,
                teamId
            })
            return false
        }
    }

    if (isPublicChannel) {
        return workspaceUserIntegrations
    }

    const channelMembershipChecks = await Promise.all(
        workspaceUserIntegrations.map(async integration => ({
            integration,
            isMember: await isInChannel(integration)
        }))
    )
    return channelMembershipChecks.filter(({ isMember }) => isMember).map(({ integration }) => integration)
}

async function processSlackAutomationForUsers(args: {
    filteredWorkspaceUserIntegrations: UserSlackIntegrationWithSlack[]
    slackEventData: SlackTrigger
    storedFiles?: StoredFile[]
    teamId: string
    sourceChannelId?: string
}): Promise<number> {
    const { filteredWorkspaceUserIntegrations, slackEventData, storedFiles, teamId, sourceChannelId } = args
    let totalMatches = 0
    for (const userSlackIntegration of filteredWorkspaceUserIntegrations) {
        try {
            const organizationId = userSlackIntegration.organization_id
            if (!organizationId) continue
            const fullUser = await getUserForOrg(userSlackIntegration.user_id, organizationId)
            if (!fullUser) continue
            await runWithUserContext(fullUser, async () => {
                const slackEvent = new SlackTriggerRuntime(slackEventData, userSlackIntegration.id, storedFiles)
                const eventProcessor = new EventProcessor(slackEvent, fullUser)
                const results = await eventProcessor.process()

                if (results.length > 0 && results.some(r => r.success || r.agentConfig !== null)) {
                    totalMatches += results.filter(r => r.success || r.agentConfig !== null).length
                    logger.info(`User ${fullUser.email}: ${results.length} automation(s) matched`, {
                        userId: fullUser.id,
                        email: fullUser.email,
                        resultsCount: results.length,
                        teamId
                    })
                }
            })
        } catch (error) {
            logger.error(`Error processing automations for user ${userSlackIntegration.user_id}`, {
                error,
                userId: userSlackIntegration.user_id
            })
        }
    }

    logger.info(`Slack event processed - ${totalMatches} total automation(s) matched across all workspace users`, {
        totalMatches,
        teamId,
        channel: sourceChannelId
    })
    return totalMatches
}

// Rate-limits the unrecognized-DM / @mention fallback so a chatty user can't
// turn it into a flood. One reply per (team, channel) per hour is enough to
// satisfy reviewer tests without spamming.
let fallbackReplyLimiter: KeyLimiter | null = null
function getFallbackReplyLimiter(): KeyLimiter {
    if (!fallbackReplyLimiter) {
        fallbackReplyLimiter = RateLimiterClient.getInstance().createKeyLimiter({
            name: "slack_unrecognized_fallback",
            points: 1,
            duration: 60 * 60,
            blockDuration: 60 * 60
        })
    }
    return fallbackReplyLimiter
}

const SLACK_FALLBACK_TEXT =
    "Hi! I'm Terse. I run automations configured in your workspace's Terse dashboard. I don't have a workflow set up to respond to this message. Visit https://useterse.ai for setup, or contact your admin."

async function sendSlackUnrecognizedFallback(args: { teamId: string; channelId: string; threadTs?: string | null; slackIntegrationId: string }) {
    const allowed = await getFallbackReplyLimiter().tryConsume(`${args.teamId}:${args.channelId}`)
    if (!allowed) return

    const secretService = SecretService.getInstance()
    const secrets = await secretService.tryGetSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.SLACK, recordId: args.slackIntegrationId }
    })
    const botToken = secrets?.accessToken
    if (!botToken) {
        logger.warn("Cannot send Slack fallback reply — bot token unavailable", { teamId: args.teamId })
        return
    }

    const client = new WebClient(botToken, { logLevel: LogLevel.ERROR })
    try {
        await client.chat.postMessage({
            channel: args.channelId,
            thread_ts: args.threadTs || undefined,
            text: SLACK_FALLBACK_TEXT
        })
    } catch (error) {
        logger.warn("Failed to send Slack fallback reply", {
            error,
            teamId: args.teamId,
            channelId: args.channelId
        })
    }
}

async function handleSlackMessageLikeEvent(event: SimplifiedSlackEvent, teamId: string) {
    try {
        logger.debug("Processing Slack message-like event", {
            event: JSON.stringify(event, null, 2),
            teamId
        })

        const messageEvent = event.event
        if (!messageEvent || (messageEvent.type !== "message" && messageEvent.type !== "app_mention")) {
            logger.debug("Event is not a message-like event", {
                eventType: messageEvent?.type,
                teamId
            })
            return
        }

        // Get the Slack integration
        const slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: teamId
            }
        })

        if (!slackIntegration) {
            logger.warn("Slack integration not found", { teamId })
            return
        }

        const isAppMention = messageEvent.type === "app_mention"
        const isDirectMessage = messageEvent.channel_type === SlackChannelType.IM
        const isFromHumanUser = !messageEvent.bot_id && messageEvent.subtype !== "bot_message"
        const shouldFallback = isFromHumanUser && (isAppMention || isDirectMessage) && Boolean(messageEvent.channel)

        const filteredWorkspaceUserIntegrations = await getFilteredWorkspaceUserIntegrations(teamId, messageEvent.channel!, messageEvent.channel_type || null)

        if (filteredWorkspaceUserIntegrations.length === 0) {
            logger.info("No users found with Slack integrations for this workspace", {
                teamId
            })
            if (shouldFallback) {
                await sendSlackUnrecognizedFallback({
                    teamId,
                    channelId: messageEvent.channel!,
                    threadTs: messageEvent.thread_ts,
                    slackIntegrationId: slackIntegration.id
                })
            }
            return
        }

        const client: WebClient = await initializeSlackWebClient(filteredWorkspaceUserIntegrations[0])

        logger.debug(`📡 Fetching additional Slack data for channel ${messageEvent.channel}, user ${messageEvent.user}, message ${messageEvent.ts}`, {
            channel: messageEvent.channel,
            user: messageEvent.user,
            messageTs: messageEvent.ts,
            teamId
        })

        const enrichedMessage = await fetchEnrichedSlackMessageData(client, {
            channel: messageEvent.channel!,
            user: messageEvent.user!,
            ts: messageEvent.ts!,
            text: messageEvent.text,
            thread_ts: messageEvent.thread_ts,
            channel_type: messageEvent.channel_type
        })

        // Supports: images, PDFs
        let storedFiles: StoredFile[] = []
        if (enrichedMessage.files && enrichedMessage.files.length > 0) {
            const secretService = SecretService.getInstance()
            const secrets = await secretService.tryGetSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.SLACK, recordId: filteredWorkspaceUserIntegrations[0].slack_integration.id }
            })
            const botToken = secrets?.accessToken
            if (botToken) {
                storedFiles = await downloadSlackFiles(enrichedMessage.files, teamId, botToken)
            } else {
                logger.warn("No Slack bot token available for file download", { teamId })
            }
        }

        // Build the canonical Slack trigger event with all available information
        const slackEventData = buildSlackTriggerData({
            eventType: messageEvent.type === "app_mention" ? SlackEventType.APP_MENTION : SlackEventType.MESSAGE,
            channelId: messageEvent.channel!,
            channelName: enrichedMessage.channelName || null,
            userId: messageEvent.user!,
            userName: enrichedMessage.userName || null,
            text: enrichedMessage.text,
            timestamp: messageEvent.ts!,
            threadTimestamp: messageEvent.thread_ts || null,
            teamId,
            permalink: enrichedMessage.permalink || null,
            channelType: inferSlackChannelType(messageEvent.channel!, messageEvent.channel_type || null),
            blocks: enrichedMessage.blocks || null,
            attachments: enrichedMessage.attachments || null,
            files: enrichedMessage.files || null
        })

        const totalMatches = await processSlackAutomationForUsers({
            filteredWorkspaceUserIntegrations,
            slackEventData,
            storedFiles,
            teamId,
            sourceChannelId: messageEvent.channel
        })

        if (totalMatches === 0 && shouldFallback) {
            await sendSlackUnrecognizedFallback({
                teamId,
                channelId: messageEvent.channel!,
                threadTs: messageEvent.thread_ts,
                slackIntegrationId: slackIntegration.id
            })
        }
    } catch (error) {
        logger.error("Error handling Slack message-like event", { error, teamId })
    }
}

async function handleSlackReactionAdded(event: SimplifiedSlackEvent, teamId: string) {
    try {
        logger.debug("Processing Slack reaction_added event", {
            event: JSON.stringify(event, null, 2),
            teamId
        })

        const reactionEvent = event.event
        if (!reactionEvent || reactionEvent.type !== "reaction_added" || !reactionEvent.item?.channel || !reactionEvent.item.ts || !reactionEvent.user) {
            logger.debug("Event is not a valid reaction_added event", {
                eventType: reactionEvent?.type,
                teamId
            })
            return
        }

        const filteredWorkspaceUserIntegrations = await getFilteredWorkspaceUserIntegrations(teamId, reactionEvent.item.channel, null)
        if (filteredWorkspaceUserIntegrations.length === 0) {
            logger.info("No users found with Slack integrations for this workspace", {
                teamId
            })
            return
        }

        const client: WebClient = await initializeSlackWebClient(filteredWorkspaceUserIntegrations[0])
        const enrichedMessage = await fetchEnrichedSlackMessageData(client, {
            channel: reactionEvent.item.channel,
            user: reactionEvent.item_user || reactionEvent.user,
            ts: reactionEvent.item.ts,
            text: "",
            channel_type: inferSlackChannelType(reactionEvent.item.channel, null) || undefined
        })

        const slackEventData = buildSlackTriggerData({
            eventType: SlackEventType.REACTION_ADDED,
            channelId: reactionEvent.item.channel,
            channelName: enrichedMessage.channelName || null,
            userId: reactionEvent.user,
            userName: null,
            text: enrichedMessage.text,
            timestamp: reactionEvent.event_ts || reactionEvent.item.ts,
            threadTimestamp: null,
            teamId,
            permalink: enrichedMessage.permalink || null,
            channelType: inferSlackChannelType(reactionEvent.item.channel, null),
            blocks: enrichedMessage.blocks || null,
            attachments: enrichedMessage.attachments || null,
            files: enrichedMessage.files || null,
            reaction: reactionEvent.reaction || null,
            itemType: reactionEvent.item.type || null,
            itemUserId: reactionEvent.item_user || null,
            itemChannelId: reactionEvent.item.channel,
            itemTimestamp: reactionEvent.item.ts
        })

        await processSlackAutomationForUsers({
            filteredWorkspaceUserIntegrations,
            slackEventData,
            teamId,
            sourceChannelId: reactionEvent.item.channel
        })
    } catch (error) {
        logger.error("Error handling Slack reaction_added", { error, teamId })
    }
}

/**
 * Returns the Slack access token for the given integration. Use this once then pass the token
 * to validateSlackChannelsExist and validateSlackUserIds to avoid fetching the token twice.
 */
export async function getSlackAccessTokenOrThrow(integrationId: string): Promise<string> {
    const manager = new SlackIntegrationManager()
    const token = await manager.getAccessToken(integrationId)
    if (!token) {
        throw new Error(`Slack integration ${integrationId} not found or missing access token`)
    }
    return token
}

/**
 * Verifies that the given Slack channels exist and are accessible with the provided token (bulk, parallel).
 */
export async function validateSlackChannelsExist(accessToken: string, channelIds: string[]): Promise<void> {
    if (!channelIds.length) return
    const client = new WebClient(accessToken, { logLevel: LogLevel.ERROR })
    const results = await Promise.all(
        channelIds.map(async channelId => {
            const result = await client.conversations.info({ channel: channelId })
            return { channelId, ok: result.ok && !!result.channel }
        })
    )
    const missing = results.filter(r => !r.ok).map(r => r.channelId)
    if (missing.length > 0) {
        throw new Error(`Slack channel(s) not found or not accessible: ${missing.join(", ")}`)
    }
}

/**
 * Verifies that the given Slack user IDs exist and are accessible with the provided token (bulk, parallel).
 */
export async function validateSlackUserIds(accessToken: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return
    const client = new WebClient(accessToken, { logLevel: LogLevel.ERROR })
    const results = await Promise.all(
        userIds.map(async userId => {
            const result = await client.users.info({ user: userId })
            return { userId, ok: result.ok && !!result.user }
        })
    )
    const missing = results.filter(r => !r.ok).map(r => r.userId)
    if (missing.length > 0) {
        throw new Error(`Slack user(s) not found or not accessible: ${missing.join(", ")}`)
    }
}

async function downloadSlackFiles(files: SlackFiles, teamId: string, botToken: string): Promise<StoredFile[]> {
    try {
        const supportedFiles = filterSupportedSlackFiles(files)
        if (!supportedFiles || supportedFiles.length === 0) return []

        // Check if bot has files:read permission before attempting downloads
        const canReadFiles = await hasFilesReadScope(botToken)
        if (!canReadFiles) {
            logger.warn(`Skipping file downloads - bot token is missing 'files:read' scope. ` + `Users need to re-install the Slack app to grant file access.`, {
                teamId,
                fileCount: supportedFiles.length
            })
            return []
        }

        const storedFiles = await Promise.all(supportedFiles.map(file => processSlackFile({ file, teamId, botToken })))

        return storedFiles.filter((f): f is StoredFile => f !== null)
    } catch (error) {
        // Don't let file download failures break the entire event
        // This can happen e.g. when the user needs to reinstall their Slack app
        logger.error(`Failed to download Slack files`, {
            error,
            teamId,
            fileCount: files ? files.length : 0
        })
        return []
    }
}

function filterSupportedSlackFiles(files: SlackFiles): SlackFiles {
    if (!files) return []
    return files.filter(file => {
        const mimetype = file.mimetype ?? ""
        const filename = file.name ?? file.title ?? ""
        return isSupportedFileType(mimetype, filename)
    })
}

async function processSlackFile(args: { file: SlackFile; teamId: string; botToken: string }): Promise<StoredFile | null> {
    const { file, teamId, botToken } = args

    try {
        const downloadUrl = pickSlackFileUrl(file)
        if (!downloadUrl) {
            logger.warn(`No download URL found for Slack file`, {
                fileId: file.id,
                teamId
            })
            return null
        }
        if (!file.id) {
            logger.warn(`No file ID found for Slack file`, {
                fileId: file.id,
                teamId
            })
            return null
        }
        const primaryKey = buildSlackFileKey(teamId, file.id)

        const storedFile = await ensureStoredWithMetadata(primaryKey, async (): Promise<FileDownloadResult> => {
            return downloadSlackFile({ downloadUrl, botToken, file })
        })

        if (storedFile) {
            logger.debug(`✅ Stored Slack file in GCS`, {
                teamId,
                fileId: file.id,
                filename: file.name || file.title,
                category: storedFile.category
            })
        }

        return storedFile ?? null
    } catch (error) {
        logger.error(`Error storing Slack file`, {
            error,
            teamId,
            fileId: file.id,
            filename: file.name || file.title
        })
        return null
    }
}

/**
 * Check if the bot token has the files:read scope required for downloading files.
 * Uses auth.test API which returns scopes in response_metadata.
 */
async function hasFilesReadScope(botToken: string): Promise<boolean> {
    try {
        const client = new WebClient(botToken)
        const authResult = await client.auth.test()

        if (!authResult.ok) {
            logger.warn("Bot token auth.test failed", { error: authResult.error })
            return false
        }

        // Scopes are returned in response_metadata.scopes as an array
        const scopes = authResult.response_metadata?.scopes as string[] | undefined
        if (!scopes) {
            logger.warn("Could not determine bot token scopes - response_metadata.scopes not present")
            // Fall back to attempting the download (will be validated by isValidFileResponse)
            return true
        }

        const hasFilesRead = scopes.includes("files:read")
        if (!hasFilesRead) {
            logger.warn(`Bot token is missing 'files:read' scope. Current scopes: ${scopes.join(", ")}. ` + `Users need to re-install the Slack app to grant file access.`)
        }

        return hasFilesRead
    } catch (error) {
        logger.warn("Failed to check bot token scopes", { error })
        return false
    }
}

async function downloadSlackFile(args: { downloadUrl: string; botToken: string; file: SlackFile }): Promise<FileDownloadResult> {
    const { downloadUrl, botToken, file } = args

    const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${botToken}` }
    })

    if (!response.ok) {
        throw new Error(`Failed to download Slack file: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const mimeType = file.mimetype || response.headers.get("content-type") || "application/octet-stream"

    const filename = file.name || file.title || undefined

    logger.debug(`Successfully downloaded Slack file`, {
        fileId: file.id,
        filename,
        mimeType,
        size: buffer.length
    })

    return { data: buffer, mimeType, filename }
}

/**
 * Type for Slack API responses that follow the standard { ok: boolean; error?: string } pattern
 */
type SlackApiResponse<T = unknown> = { ok: boolean; error?: string } & T

/**
 * Type for Promise.allSettled results from Slack API calls
 */
type SlackApiSettledResult<T = unknown> = PromiseSettledResult<SlackApiResponse<T>>

/**
 * Relevant Slack event data simplified for Terse
 */
export interface SimplifiedSlackEvent {
    // Top-level payload fields
    type: "event_callback" | "app_uninstalled" | "tokens_revoked" | "url_verification"
    team_id: string
    event_id?: string
    authorizations?: SlackAuthorizations[]
    // For top-level tokens_revoked events
    tokens?: {
        bot?: string[]
        oauth?: string[]
    }

    // The actual event data (for event_callback type)
    event?: {
        type: "message" | "app_mention" | "reaction_added" | "app_uninstalled" | "tokens_revoked"
        channel?: string
        user?: string
        text?: string
        ts?: string
        bot_id?: string
        subtype?: string
        thread_ts?: string
        // Additional fields that may be present in Slack message events
        edited?: {
            user: string
            ts: string
        }
        reactions?: Reaction[]
        client_msg_id?: string
        parent_user_id?: string
        reply_count?: number
        reply_users?: string[]
        reply_users_count?: number
        latest_reply?: string
        team?: string
        event_ts?: string
        channel_type?: SlackChannelType
        reaction?: string
        item_user?: string
        item?: {
            type: string
            channel?: string
            ts?: string
        }
        tokens?: {
            bot?: string[]
            oauth?: string[]
        }
    }
}

interface SlackAuthorizations {
    enterprise_id: string | null
    team_id: string
    user_id: string
    is_bot: boolean
    is_enterprise_install: boolean
}

enum AuthedUserTokenType {
    user = "user"
}

/**
 * Slack OAuth response interface
 */
interface SlackOAuthResponse {
    ok: boolean
    error?: string
    access_token: string
    token_type: string
    bot_user_id: string
    app_id: string
    team: {
        name: string
        id: string
    }
    enterprise: {
        name: string
        id: string
    }
    authed_user: {
        id: string
        access_token?: string
        token_type?: AuthedUserTokenType
    }
}
