import { LogLevel, WebClient } from "@slack/web-api"
import { Member as SlackUser } from "@slack/web-api/dist/types/response/UsersListResponse"
import { Request, Response } from "express"

import { SlackIntegrationManager, fetchSlackChannelsForIntegration } from "../integrations/SlackIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { SlackUsersResponse, User } from "../shared/types"
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

        // Both bot and user tokens can list users (e.g. for output DM destination selection)
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
