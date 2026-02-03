import { LogLevel, WebClient } from "@slack/web-api"
import { Member as SlackUser } from "@slack/web-api/dist/types/response/UsersListResponse"
import { Request, Response } from "express"

import { SlackIntegrationManager } from "../integrations/SlackIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { SlackChannel, SlackChannelsResponse, SlackUsersResponse, User } from "../shared/types"
import { UserSlackIntegrationWithUser } from "../types/prisma"

// MARK: - Route Handlers

export async function getSlackIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new SlackIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Slack integrations", {
            error,
            userId: req.session?.user?.id
        })
        res.status(500).json({ error: "Failed to fetch Slack integrations" })
    }
}

/**
 * Get current Slack integration for the authenticated user
 */
export async function getCurrentSlackIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(500).json({ message: "User not found" })
        return
    }

    const user: User = req.session.user

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            user_id: user.id
        },
        orderBy: {
            created_at: "desc"
        }
    })

    if (!userSlackIntegration) {
        res.status(404).json({ teamName: null })
        return
    }

    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            team_id: userSlackIntegration?.slack_team_id
        }
    })

    if (!slackIntegration || !userSlackIntegration) {
        res.status(404).json({ teamName: null })
        return
    }

    res.status(200).json({ teamName: slackIntegration.team_name })
}

/**
 * Handle Slack OAuth callback
 */
export async function slackOAuthCallback(req: Request, res: Response) {
    const integration = new SlackIntegrationManager()
    await integration.processInstallationCallback(req, res)
}

const getToken = (integration: UserSlackIntegrationWithUser) => {
    return integration.authed_user_access_token || integration.slack_integration.access_token
}

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

    const token = getToken(userSlackIntegration)
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

        const channels: SlackChannel[] = []

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

export const getSlackChannels = async (req: Request, res: Response) => {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }
    if (!user.organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    const integrationId = req.query.integrationId as string
    if (!integrationId) {
        return res.status(400).json({ error: "integrationId is required" })
    }

    try {
        const response = await fetchSlackChannelsForIntegration(user.id, user.organizationId, integrationId)
        res.status(200).json(response)
    } catch (error: any) {
        logger.error("Error fetching Slack channels", {
            error,
            integrationId,
            userId: user.id
        })
        res.status(error?.statusCode || 500).json({
            error: error.message || "Failed to fetch channels",
            details: error.details,
            code: error.code
        })
    }
}

export const getSlackUsers = async (req: Request, res: Response) => {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }
    if (!user.organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    const integrationId = req.query.integrationId as string
    if (!integrationId) {
        return res.status(400).json({ error: "integrationId is required" })
    }

    try {
        // Verify user owns this integration and it belongs to their organization
        // For Slack, integrationId is user_slack_integrations.id
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: {
                id: integrationId,
                organization_id: user.organizationId
            },
            include: {
                slack_integration: true,
                user: true
            }
        })

        if (!userSlackIntegration || !userSlackIntegration.slack_integration) {
            return res.status(404).json({ error: "Slack integration not found" })
        }

        const token = getToken(userSlackIntegration)
        const isBotUser = userSlackIntegration.is_bot_user

        if (isBotUser) {
            return res.status(400).json({ error: "Bot user cannot fetch users" })
        }

        const client = new WebClient(token, {
            logLevel: LogLevel.ERROR
        })
        const users = await client.users.list({})
        if (!users.ok) {
            return res.status(500).json({ error: "Failed to fetch users" })
        }
        if (!users.members || users.members.length === 0) {
            return res.status(200).json({ users: [] })
        }

        const response: SlackUsersResponse = {
            users:
                users.members
                    ?.filter((member): member is SlackUser & { id: string; name: string } => Boolean(member.id && member.name) && !member.is_bot)
                    .map(member => ({
                        id: member.id,
                        name: member.name
                    })) || []
        }

        res.status(200).json(response)
    } catch (error: any) {
        logger.error("Error fetching Slack users:", { error })
        res.status(500).json({ error: "Failed to fetch users" })
    }
}

export async function handleSlackInteraction(req: Request, res: Response) {
    res.sendStatus(200)
    return
}

// MARK: - Helper Functions

/**
 * Helper function to open a DM channel with a user
 */
async function openChat(accessToken: string, authedUserId: string) {
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

// MARK: - Types

/**
 * Slack OAuth response interface
 */
export interface SlackOAuthResponse {
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
        access_token: string
        token_type: string
    }
}
