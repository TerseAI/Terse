import { InputConfigType } from "@prisma/client"
import { KnownBlock } from "@slack/types"
import { LogLevel, WebClient } from "@slack/web-api"
import { Member as SlackUserMember } from "@slack/web-api/dist/types/response/UsersListResponse"
import axios from "axios"
import crypto from "crypto"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { jwt as jwtConfig, slack as slackConfig, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { FileCategory, FileDownloadResult, StoredFile, buildSlackFileKey, ensureStoredWithMetadata, isSupportedFileType } from "../services/FileStorageService"
import { ConfigInstance, ConfigType, SlackConfig as SlackConfigClass } from "../shared/Configs"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationType, SlackIntegration, SlackIntegrationMetadata } from "../shared/Integrations"
import { RunHistoryTrigger } from "../shared/RunHistoryTypes"
import { OAuthInstallationDetails, SlackChannel as SlackChannelShared, SlackChannelType, SlackChannelsResponse, SlackUserResponse, SlackUsersResponse } from "../shared/types"
import { SlackAttachment, SlackFile, SlackMessageImage, extractImagesFromMessage, extractTextFromAttachments, extractTextFromBlocks, pickSlackFileUrl } from "../slack/blockKitHelpers"
import { AgentTriggerWithConfigs, UserSlackIntegration, UserSlackIntegrationWithUser } from "../types/prisma"
import { HydratorType } from "../types/rag"
import { Jwt } from "../utility/jwt"
import { createOAuthStateToken } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { initializeSlackWebClient } from "./SlackClient"
import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { InputEvent } from "./abstract/InputEvent"
import { ConfigurationFieldDefinition, Integration, IntegrationWithResources, OAuthIntegrationInstallation } from "./abstract/Integration"

export class SlackIntegrationManager
    implements Integration<SlackIntegration, SlackMessageEvent, typeof SlackIntegrationMetadata, SlackChannelShared | SlackUserResponse>, OAuthIntegrationInstallation<IntegrationType.SLACK>
{
    constructor() {}
    integrationType: IntegrationType = IntegrationType.SLACK

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

    async processWebhookEvent(event: SlackMessageEvent): Promise<void> {
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
                    const tokensEvent = eventData as {
                        tokens?: { bot?: string[]; oauth?: string[] }
                    }
                    await tokensEvent.tokens?.bot?.forEach(deactivateToken)
                    await tokensEvent.tokens?.oauth?.forEach(deactivateToken)
                    break
                case "message":
                    // Process message asynchronously (fire and forget - errors are logged but don't affect Slack)
                    handleSlackMessage(event, team_id, authorizations as SlackAuthorizations[]).catch(error => {
                        logger.error("Error processing Slack message in background", {
                            error
                        })
                    })
                    break
            }
        } else if (type === "app_uninstalled") {
            await markWorkspaceUninstalled(team_id)
        } else if (type === "tokens_revoked") {
            const tokensEvent = event as {
                tokens?: { bot?: string[]; oauth?: string[] }
            }
            await tokensEvent.tokens?.bot?.forEach(deactivateToken)
            await tokensEvent.tokens?.oauth?.forEach(deactivateToken)
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
        options?: InstallationOptionsFor<IntegrationType.SLACK>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        if (!options) {
            throw new Error("Slack integration requires options (isBotUser)")
        }
        const client_id = slackConfig.clientId
        const redirect_uri = slackConfig.oauthCallbackUrl
        const isBotUser = options.isBotUser
        const scope =
            "channels:history,channels:manage,groups:history,groups:write,im:history,im:write,mpim:history,mpim:write,channels:read,groups:read,mpim:read,im:read,users:read,chat:write,app_mentions:read,reactions:read,reactions:write,files:read"
        const user_scope = isBotUser
            ? ""
            : "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,channels:write,groups:write,mpim:write,im:write,chat:write,reactions:read,reactions:write,files:read"
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalFields: { isBotUser },
            additionalStatePayload,
            expiresIn: "7d",
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

        const jwtUtil = new Jwt()
        const user = await jwtUtil.verify(state)

        if (!user) {
            logger.error("Invalid or expired state token")
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        // Decode the full JWT state payload
        let decoded: any
        try {
            decoded = jwt.verify(state, jwtConfig.secret)
        } catch (error) {
            logger.error("Error decoding JWT state", { error })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }
        const organizationId = decoded.organizationId

        if (!organizationId || typeof organizationId !== "string") {
            logger.error("Slack OAuth: organizationId is required in state", {
                userId: user.user.id
            })
            res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        const client_id = slackConfig.clientId
        const client_secret = slackConfig.clientSecret
        const redirect_uri = slackConfig.oauthCallbackUrl

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

            logger.debug("Slack OAuth response", { data: response.data })

            const { access_token, authed_user, team } = response.data

            if (!response.data.ok || !team || !team.id) {
                logger.error("Slack OAuth response not ok", { data: response.data })
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
                            team_name: response.data.team.name,
                            access_token: access_token
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
                            team_name: response.data.team.name,
                            access_token: access_token
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
                          authed_user_access_token: authed_user.access_token,
                          organization_id: organizationId
                      }
                    : {
                          authed_user_id: authed_user.id,
                          organization_id: organizationId
                      }

                const createData =
                    isUserType && authed_user.access_token
                        ? {
                              user_id: user.user.id,
                              slack_team_id: slackIntegration.team_id,
                              authed_user_id: authed_user.id,
                              authed_user_access_token: authed_user.access_token,
                              is_bot_user: false,
                              organization_id: organizationId
                          }
                        : {
                              user_id: user.user.id,
                              slack_team_id: slackIntegration.team_id,
                              authed_user_id: authed_user.id,
                              is_bot_user: true,
                              organization_id: organizationId
                          }

                await tx.user_slack_integrations.upsert({
                    where: {
                        user_id_slack_team_id_is_bot_user: {
                            user_id: user.user.id,
                            slack_team_id: slackIntegration.team_id,
                            is_bot_user: !isUserType
                        }
                    },
                    update: {
                        ...updatePayload
                    },
                    create: createData
                })
            })

            // Get the user_slack_integration ID after upsert
            const userSlackIntegration = await db().user_slack_integrations.findFirst({
                where: {
                    user_id: user.user.id,
                    slack_team_id: team.id,
                    is_bot_user: !isUserType
                }
            })

            if (!userSlackIntegration) {
                logger.error("Failed to find user_slack_integration after OAuth", {
                    userId: user.user.id,
                    teamId: team.id
                })
                res.redirect(`${frontendUrl}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.SLACK, userSlackIntegration.id, decoded.userId, decoded, new Date()))

            logger.info("Slack OAuth completed successfully", {
                userId: user.user.id,
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
                logLevel: LogLevel.DEBUG
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

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
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

            // Slack tokens are long-lived and don't expire, so just return the token
            return userSlackIntegration.slack_integration.access_token || null
        } catch (error) {
            logger.error(`Error getting Slack access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, triggerConfig: ConfigInstance, options?: { limit?: number }): Promise<InputEvent[]> {
        if (triggerConfig.configType !== ConfigType.SLACK) {
            return []
        }
        const slackConfig = triggerConfig as SlackConfigClass

        const limit = Math.min(options?.limit ?? 5, 10)
        const prisma = db()

        const userSlackIntegration = await prisma.user_slack_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId },
            include: { slack_integration: true, user: true }
        })

        if (!userSlackIntegration?.slack_integration) {
            throw new Error(`Slack integration ${integrationId} not found`)
        }

        // Use user token for DMs when available (user's DMs), otherwise bot token (bot's DMs). Same for channels: bot token.
        const token = getSlackToken(userSlackIntegration)
        if (!token) {
            throw new Error(`Slack access token not found for integration ${integrationId}. Please reconnect your Slack workspace.`)
        }

        const client = new WebClient(token, { logLevel: LogLevel.ERROR })
        const teamId = userSlackIntegration.slack_integration.team_id

        let messages: Array<{
            channel: string
            ts: string
            user?: string
            text?: string
            thread_ts?: string
            channel_type?: SlackChannelType
            blocks?: unknown[]
            attachments?: unknown[]
            files?: unknown[]
        }> = []

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

        const events: InputEvent[] = []
        for (const msg of messages) {
            const [channelInfo, userInfo, permalinkResult, fullMessageResult] = await Promise.allSettled([
                client.conversations.info({ channel: msg.channel }),
                client.users.info({ user: msg.user! }),
                client.chat.getPermalink({ channel: msg.channel, message_ts: msg.ts }),
                client.conversations.history({
                    channel: msg.channel,
                    oldest: msg.ts,
                    latest: msg.ts,
                    inclusive: true,
                    limit: 1
                })
            ])

            const channelResult = processSlackApiResult<{ channel?: SlackChannel }>(channelInfo as SlackApiSettledResult<{ channel?: SlackChannel }>, "Channel info", "Failed to fetch channel info")
            const userResult = processSlackApiResult<{ user?: SlackUser }>(userInfo as SlackApiSettledResult<{ user?: SlackUser }>, "User info", "Failed to fetch user info")
            const permalinkApiResult = processSlackApiResult<{ permalink?: string }>(
                permalinkResult as SlackApiSettledResult<{ permalink?: string }>,
                "Message permalink",
                "Failed to fetch message permalink"
            )
            const channelName = extractChannelName(channelResult, userResult, msg.user!, msg.channel)
            const userName = extractUserName(userResult)
            const permalink = permalinkApiResult.success ? permalinkApiResult.data?.permalink : undefined

            let blocks = msg.blocks as KnownBlock[] | undefined
            let attachments = msg.attachments as SlackAttachment[] | undefined
            let files = msg.files as SlackFile[] | undefined
            let text = msg.text || ""
            if (fullMessageResult.status === PromiseSettledStatus.FULFILLED && fullMessageResult.value.ok && fullMessageResult.value.messages?.[0]) {
                const full = fullMessageResult.value.messages[0]
                if (!blocks && full.blocks) blocks = full.blocks as KnownBlock[]
                if (!attachments && full.attachments) attachments = full.attachments as SlackAttachment[]
                if (!files && full.files) files = full.files as SlackFile[]
                if (!text && full.text) text = full.text
            }

            const slackEventData: SlackEventData = {
                channelId: msg.channel,
                channelName,
                userId: msg.user!,
                userName,
                text,
                timestamp: msg.ts,
                threadTimestamp: msg.thread_ts,
                teamId,
                permalink,
                channelType: msg.channel_type,
                blocks,
                attachments,
                files
            }
            events.push(new SlackEvent(slackEventData))
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

const getSlackToken = (integration: UserSlackIntegrationWithUser) => {
    return integration.authed_user_access_token || integration.slack_integration.access_token
}

/**
 * Fetches Slack channels for an integration.
 * Moved here from routes/slack.ts to avoid circular dependency.
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
            slack_integration: true,
            user: true
        }
    })

    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
        throw createSlackRouteError("Slack integration not found", 404)
    }

    const token = getSlackToken(userSlackIntegration)
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
            slack_integration: true,
            user: true
        }
    })
    if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
        throw createSlackRouteError("Slack integration not found", 404)
    }

    const token = getSlackToken(userSlackIntegration)
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

export class SlackEvent extends InputEvent implements Identifiable {
    readonly integrationType: IntegrationType = IntegrationType.SLACK
    data: SlackEventData
    entityType: HydratorType = HydratorType.SLACK_MESSAGE_EVENT
    entityId: string

    constructor(data: SlackEventData) {
        super()
        this.data = data
        this.entityId = `${data.teamId}:${data.permalink || ""}`
    }

    formatForAgentRunner(): string {
        // Extract rich content from blocks and attachments (used by third-party apps)
        const blockContent = this.data.blocks ? extractTextFromBlocks(this.data.blocks) : ""
        const attachmentContent = this.data.attachments ? extractTextFromAttachments(this.data.attachments) : ""

        // Determine the main message content
        // If text is empty but we have block/attachment content, note that
        const messageText = this.data.text || "(no plain text)"

        return `
        Incoming Slack Message Event.

        Slack Event:
        Channel: ${this.data.channelName || this.data.channelId}
        User: ${this.data.userName || this.data.userId}
        Message: ${messageText}
        Timestamp: ${this.data.timestamp}
        ${this.data.threadTimestamp ? `Thread: ${this.data.threadTimestamp}` : ""}
        Team ID: ${this.data.teamId}
        ${
            blockContent
                ? `
        Rich Content (from blocks):
        ${blockContent}`
                : ""
        }
        ${
            attachmentContent
                ? `
        Attachment Content:
        ${attachmentContent}`
                : ""
        }
        `
    }

    /**
     * Extract all images from the Slack message
     * Images can come from:
     * - Block Kit image blocks
     * - Section block accessories
     * - Context block elements
     * - Attachments (image_url, thumb_url)
     * - File uploads (files array)
     *
     * @returns Array of image objects with URLs and metadata
     */
    getImages(): SlackMessageImage[] {
        return extractImagesFromMessage(this.data)
    }

    /**
     * Get all stored files with full metadata (images, documents)
     * Includes both private files cached in GCS and public block/attachment images
     */
    getFiles(): StoredFile[] {
        const files: StoredFile[] = [...(this.data.storedFiles || [])]
        const publicImages = this.getImages().filter(img => !img.requiresAuth)
        for (const img of publicImages) {
            files.push({
                url: img.url,
                mimeType: "image/png",
                category: FileCategory.IMAGE
            })
        }
        return files
    }

    debugLog(): string {
        const isDM = this.data.channelType === SlackChannelType.IM
        return `Slack Event: ${isDM ? "DM" : this.data.channelName || this.data.channelId} - ${this.data.userName || this.data.userId}}`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        // Check if integration type matches
        if (agentTrigger.config_type !== InputConfigType.SLACK) {
            return false
        }

        // If agentTrigger has slack_config with channel_id, filter by channel
        // Otherwise, all Slack events match (no channel filtering)
        const slackConfig = agentTrigger.slack_config
        if (!slackConfig) {
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
            event: "message_received",
            integration: IntegrationType.SLACK,
            source: this.data.channelName || this.data.channelId,
            title: this.data.text.substring(0, 100), // First 100 chars of message
            subheader: this.data.userName || this.data.userId,
            url: this.data.permalink
        }
    }
}

async function markWorkspaceUninstalled(team_id: string) {
    logger.info("Workspace uninstalled. Deleting records from database...", {
        teamId: team_id
    })
    await db().user_slack_integrations.deleteMany({
        where: {
            slack_team_id: team_id
        }
    })

    await db().slack_integrations.deleteMany({
        where: {
            team_id: team_id
        }
    })

    logger.info("Workspace uninstalled. Records deleted from database.", {
        teamId: team_id
    })
}

async function deactivateToken(token: string) {
    logger.warn("Token deactivated", { tokenLength: token.length })
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

async function handleSlackMessage(event: SlackMessageEvent, teamId: string, authorizations: SlackAuthorizations[]) {
    try {
        logger.debug("Processing Slack message event", {
            event: JSON.stringify(event, null, 2),
            teamId
        })

        // Extract the actual message event from the full payload
        const messageEvent = event.event
        if (!messageEvent || messageEvent.type !== "message") {
            logger.debug("Event is not a message event", {
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

        const workspaceUserIntegrations = await db().user_slack_integrations.findMany({
            where: {
                slack_team_id: teamId
            },
            include: {
                user: true,
                slack_integration: true
            }
        })

        const channelType = messageEvent.channel_type
        const isPublicChannel = channelType === SlackChannelType.CHANNEL

        const isInChannel = async (integration: UserSlackIntegrationWithUser) => {
            try {
                const botClient = initializeSlackWebClient(integration)

                let membersRes: Awaited<ReturnType<typeof botClient.conversations.members>> | undefined
                try {
                    membersRes = await botClient.conversations.members({
                        channel: messageEvent.channel!
                    })
                } catch (error) {
                    logger.error(`Error getting members`, {
                        error,
                        channel: messageEvent.channel,
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
                        channel: messageEvent.channel,
                        teamId
                    })
                    return false
                }
            } catch (error) {
                logger.error(`Error getting members`, {
                    error,
                    channel: messageEvent.channel,
                    teamId
                })
                return false
            }
        }

        // Filter integrations: public channels include all, private/DM channels only include users who are members
        let filteredWorkspaceUserIntegrations: UserSlackIntegrationWithUser[]
        if (isPublicChannel) {
            // Public channels: include all workspace integrations
            filteredWorkspaceUserIntegrations = workspaceUserIntegrations
        } else {
            // Private channels or DMs: only include integrations where the user is in the channel
            const channelMembershipChecks = await Promise.all(
                workspaceUserIntegrations.map(async integration => ({
                    integration,
                    isMember: await isInChannel(integration)
                }))
            )
            filteredWorkspaceUserIntegrations = channelMembershipChecks.filter(({ isMember }) => isMember).map(({ integration }) => integration)
        }

        if (filteredWorkspaceUserIntegrations.length === 0) {
            logger.info("No users found with Slack integrations for this workspace", {
                teamId
            })
            return
        }

        const client: WebClient = initializeSlackWebClient(filteredWorkspaceUserIntegrations[0])

        logger.debug(`📡 Fetching additional Slack data for channel ${messageEvent.channel}, user ${messageEvent.user}, message ${messageEvent.ts}`, {
            channel: messageEvent.channel,
            user: messageEvent.user,
            messageTs: messageEvent.ts,
            teamId
        })

        // Fetch all available data from Slack API in parallel
        // Include full message fetch to get blocks/attachments (not always in event payload)
        const [channelInfo, userInfo, permalinkResult, fullMessageResult] = await Promise.allSettled([
            // Fetch channel information
            client.conversations.info({
                channel: messageEvent.channel!
            }),
            // Fetch user information
            client.users.info({
                user: messageEvent.user!
            }),
            // Get message permalink
            client.chat.getPermalink({
                channel: messageEvent.channel!,
                message_ts: messageEvent.ts!
            }),
            // Fetch full message to get blocks/attachments (Slack Events API often omits these)
            client.conversations.history({
                channel: messageEvent.channel!,
                oldest: messageEvent.ts!,
                latest: messageEvent.ts!,
                inclusive: true,
                limit: 1
            })
        ])

        // Process all API results
        const channelResult = processSlackApiResult<{ channel?: SlackChannel }>(channelInfo as SlackApiSettledResult<{ channel?: SlackChannel }>, "Channel info", "Failed to fetch channel info")

        const userResult = processSlackApiResult<{ user?: SlackUser }>(userInfo as SlackApiSettledResult<{ user?: SlackUser }>, "User info", "Failed to fetch user info")

        const permalinkApiResult = processSlackApiResult<{ permalink?: string }>(
            permalinkResult as SlackApiSettledResult<{ permalink?: string }>,
            "Message permalink",
            "Failed to fetch message permalink"
        )

        // Extract channel name and metadata
        const channelName = extractChannelName(channelResult, userResult, messageEvent.user!, messageEvent.channel!)

        // Extract user information
        const userName = extractUserName(userResult)

        // Extract permalink
        const permalink = permalinkApiResult.success ? permalinkApiResult.data?.permalink : undefined
        if (permalink) {
            logger.debug(`✓ Fetched message permalink: ${permalink}`, {
                permalink,
                channel: messageEvent.channel,
                messageTs: messageEvent.ts
            })
        }

        // Extract blocks/attachments from full message API call (Events API often omits these)
        const fullMessageApiResult = processSlackApiResult<SlackFullMessageResponse>(
            fullMessageResult as SlackApiSettledResult<SlackFullMessageResponse>,
            "Full message",
            "Failed to fetch full message"
        )

        // Use blocks/attachments/files from API if not in event payload
        let blocks = messageEvent.blocks as KnownBlock[] | undefined
        let attachments = messageEvent.attachments as SlackAttachment[] | undefined
        let files = messageEvent.files as SlackFile[] | undefined
        let text = messageEvent.text || ""

        if (fullMessageApiResult.success && fullMessageApiResult.data?.messages?.[0]) {
            // Since we limit the API call to 1 message (oldest=ts, latest=ts, limit=1),
            // the first item in the array is always the exact message we requested
            const fullMessage = fullMessageApiResult.data.messages[0]

            // Use API blocks/attachments if event payload didn't have them
            if (!blocks && fullMessage.blocks) {
                blocks = fullMessage.blocks as KnownBlock[]
                logger.debug(`✓ Extracted blocks from full message API (${blocks.length} blocks)`, { channel: messageEvent.channel, messageTs: messageEvent.ts })
            }
            if (!attachments && fullMessage.attachments) {
                attachments = fullMessage.attachments as SlackAttachment[]
                logger.debug(`✓ Extracted attachments from full message API (${attachments.length} attachments)`, { channel: messageEvent.channel, messageTs: messageEvent.ts })
            }
            if (!files && fullMessage.files) {
                files = fullMessage.files as SlackFile[]
                logger.debug(`✓ Extracted files from full message API (${files.length} files)`, { channel: messageEvent.channel, messageTs: messageEvent.ts })
            }
            // Also update text if it was empty in the event but present in full message
            if (!text && fullMessage.text) {
                text = fullMessage.text
                logger.debug(`✓ Extracted text from full message API`, {
                    channel: messageEvent.channel,
                    messageTs: messageEvent.ts
                })
            }
        }

        // Supports: images, PDFs
        let storedFiles: StoredFile[] = []
        if (files && files.length > 0) {
            const botToken = filteredWorkspaceUserIntegrations[0].slack_integration.access_token
            storedFiles = await downloadSlackFiles(files, teamId, botToken)
        }

        // Build SlackEventData with all available information
        const slackEventData: SlackEventData = {
            channelId: messageEvent.channel!,
            channelName: channelName,
            userId: messageEvent.user!,
            userName: userName,
            text: text,
            timestamp: messageEvent.ts!,
            threadTimestamp: messageEvent.thread_ts,
            teamId: teamId,
            permalink: permalink,
            channelType: messageEvent.channel_type,
            // Include blocks, attachments, and files (from event or API)
            blocks: blocks,
            attachments: attachments,
            files: files,
            storedFiles: storedFiles.length > 0 ? storedFiles : undefined
        }

        // Create SlackEvent once
        const slackEvent = new SlackEvent(slackEventData)

        // Process the event against automations for all users in this workspace
        // This ensures messages from any workspace user can trigger automations
        let totalMatches = 0
        for (const userSlackIntegration of filteredWorkspaceUserIntegrations) {
            try {
                const organizationId = userSlackIntegration.organization_id
                if (!organizationId) continue
                const fullUser = await getUserForOrg(userSlackIntegration.user.id, organizationId)
                if (!fullUser) continue
                await runWithUserContext(fullUser, async () => {
                    const eventProcessor = new EventProcessor(slackEvent, fullUser)
                    const results = await eventProcessor.process()

                    // Log results for this user
                    if (results.length > 0 && results.some(r => r.success || r.agentConfig !== null)) {
                        totalMatches += results.filter(r => r.success || r.agentConfig !== null).length
                        logger.info(`User ${fullUser.email}: ${results.length} automation(s) matched`, {
                            userId: fullUser.id,
                            email: fullUser.email,
                            resultsCount: results.length,
                            teamId
                        })
                        for (const result of results) {
                            if (result.success) {
                                logger.debug(`  ✓ Agent "${result.agentConfig?.name}" processed successfully`, {
                                    agentName: result.agentConfig?.name,
                                    userId: fullUser.id
                                })
                            } else if (result.agentConfig) {
                                logger.warn(`  ⚠ Agent "${result.agentConfig?.name}": ${result.message}`, {
                                    agentName: result.agentConfig?.name,
                                    message: result.message,
                                    userId: fullUser.id
                                })
                            }
                        }
                    }
                })
            } catch (error) {
                logger.error(`Error processing automations for user ${userSlackIntegration.user.id}`, {
                    error,
                    userId: userSlackIntegration.user.id
                })
                // Continue processing other users even if one fails
            }
        }

        logger.info(`Slack message processed - ${totalMatches} total automation(s) matched across all workspace users`, { totalMatches, teamId, channel: messageEvent.channel })
    } catch (error) {
        logger.error("Error handling Slack message", { error, teamId })
        // Note: We don't send error messages back to Slack anymore since this is now
        // event-driven automations, not interactive bot responses
    }
}

export function isValidSlackSig(req: Request) {
    const ts = req.headers["x-slack-request-timestamp"] as string
    const sig = req.headers["x-slack-signature"] as string

    if (!ts || !sig) {
        logger.warn("Missing timestamp or signature headers")
        return false
    }

    // Use SLACK_SIGNING_SECRET for signature verification (fallback to CLIENT_SECRET for backwards compatibility)
    const signingSecret = slackConfig.signingSecret || slackConfig.clientSecret
    if (!signingSecret) {
        logger.warn("No signing secret found - need SLACK_SIGNING_SECRET environment variable")
        return false
    }

    // Convert buffer to string for signature validation
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : req.body

    const baseString = `v0:${ts}:${body}`

    const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex")

    const expectedSig = `v0=${hmac}`

    const isValid = sig === expectedSig

    return isValid
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

// Re-export from SlackClient for backwards compatibility
export { initializeSlackWebClient } from "./SlackClient"

export async function downloadSlackFiles(files: SlackFile[], teamId: string, botToken: string): Promise<StoredFile[]> {
    try {
        const supportedFiles = filterSupportedSlackFiles(files)
        if (supportedFiles.length === 0) return []

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
            fileCount: files.length
        })
        return []
    }
}

function filterSupportedSlackFiles(files: SlackFile[]): SlackFile[] {
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

    const filename = file.name || file.title

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
 * Response type for conversations.history API call
 * Used to fetch full message content including blocks/attachments
 */
type SlackFullMessageResponse = {
    messages?: Array<{
        blocks?: unknown[]
        attachments?: unknown[]
        files?: unknown[]
        text?: string
    }>
}

/**
 * Slack event data
 * Processed Slack message event data used for channel events
 */
export interface SlackEventData {
    channelId: string
    channelName?: string
    userId: string
    userName?: string
    text: string
    timestamp: string
    threadTimestamp?: string
    teamId: string
    // Permalink for the message (if available)
    permalink?: string
    channelType?: SlackChannelType
    // Block Kit content from third-party apps
    blocks?: KnownBlock[]
    // Legacy attachments
    attachments?: SlackAttachment[]
    // File attachments (including images)
    files?: SlackFile[]
    storedFiles?: StoredFile[]
}

/**
 * Slack user profile object from users.info API
 */
interface SlackUserProfile {
    avatar_hash?: string
    status_text?: string
    status_emoji?: string
    real_name?: string
    display_name?: string
    real_name_normalized?: string
    display_name_normalized?: string
    email?: string
    image_original?: string
    image_24?: string
    image_32?: string
    image_48?: string
    image_72?: string
    image_192?: string
    image_512?: string
    team?: string
}

/**
 * Slack user object from users.info API
 */
interface SlackUser {
    id: string
    team_id?: string
    name?: string
    deleted?: boolean
    color?: string
    real_name?: string
    tz?: string
    tz_label?: string
    tz_offset?: number
    profile?: SlackUserProfile
    is_admin?: boolean
    is_owner?: boolean
    is_primary_owner?: boolean
    is_restricted?: boolean
    is_ultra_restricted?: boolean
    is_bot?: boolean
    updated?: number
    is_app_user?: boolean
    has_2fa?: boolean
}

/**
 * Slack channel/conversation object from conversations.info API
 * Can represent public channels, private channels, DMs, or group DMs
 */
interface SlackChannel {
    id: string
    name?: string
    is_channel?: boolean
    is_group?: boolean
    is_im?: boolean
    is_mpim?: boolean
    is_private?: boolean
    is_archived?: boolean
    is_general?: boolean
    is_shared?: boolean
    is_org_shared?: boolean
    is_member?: boolean
    created?: number
    creator?: string
    name_normalized?: string
    user?: string // For DMs, the user ID of the other person
    last_read?: string
    members?: string[]
    topic?: {
        value?: string
        creator?: string
        last_set?: number
    }
    purpose?: {
        value?: string
        creator?: string
        last_set?: number
    }
    previous_names?: string[]
}

/**
 * Full Slack event payload structure
 * This represents the complete payload sent by Slack, not just the event portion
 */
export interface SlackMessageEvent {
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
        type: "message" | "app_uninstalled" | "tokens_revoked"
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
        files?: Array<{
            id: string
            name: string
            title: string
            mimetype: string
            filetype: string
            pretty_type: string
            user: string
            size: number
            url_private?: string
            url_private_download?: string
            permalink?: string
            permalink_public?: string
        }>
        reactions?: Array<{
            name: string
            users: string[]
            count: number
        }>
        attachments?: Array<{
            fallback?: string
            color?: string
            pretext?: string
            author_name?: string
            author_link?: string
            author_icon?: string
            title?: string
            title_link?: string
            text?: string
            fields?: Array<{
                title: string
                value: string
                short: boolean
            }>
            image_url?: string
            thumb_url?: string
            footer?: string
            footer_icon?: string
            ts?: number
        }>
        blocks?: unknown[]
        client_msg_id?: string
        parent_user_id?: string
        reply_count?: number
        reply_users?: string[]
        reply_users_count?: number
        latest_reply?: string
        team?: string
        event_ts?: string
        channel_type?: SlackChannelType
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
