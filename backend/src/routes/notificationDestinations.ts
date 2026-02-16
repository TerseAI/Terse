import { NotificationDestinationType } from "@prisma/client"
import { Request, Response } from "express"

import { initializeSlackWebClient } from "../integrations/SlackClient"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import { notificationDestinationsKey } from "../shared/InvalidationKeys"
import {
    CreateNotificationDestinationRequest,
    EmailNotificationDestination,
    NotificationDestinationType as SharedNotificationDestinationType,
    SlackNotificationDestination
} from "../shared/Notifications"
import { UserNotificationDestination, UserSlackIntegrationWithUser } from "../types/prisma"

// GET /notification-destinations - List all notification destinations for the user
export async function getNotificationDestinations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id

    try {
        const destinations = await db().user_notification_destinations.findMany({
            where: {
                user_id: userId
            },
            orderBy: { created_at: "desc" }
        })

        // Transform to frontend format
        const response = destinations.map(dest => transformDestinationToFrontendFormat(dest))

        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching notification destinations", { error, userId })
        res.status(500).json({ error: "Failed to fetch notification destinations" })
    }
}

// POST /notification-destinations - Create a new notification destination
export async function createNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const { type, email, integrationId, slackChannelId, slackChannelName, slackUserId, slackUserName }: CreateNotificationDestinationRequest = req.body

    // Validate request
    if (!type) {
        res.status(400).json({ error: "Invalid request: type is required" })
        return
    }

    try {
        const prisma = db()

        // Validate based on type
        if (type === "email" && !email) {
            res.status(400).json({ error: "Invalid request: email is required for email destinations" })
            return
        }

        if (type === "slack" && !integrationId) {
            res.status(400).json({ error: "Invalid request: integrationId is required for Slack destinations" })
            return
        }

        // For Slack, validate that integration belongs to user's organization
        let resolvedSlackDestination: ResolvedSlackDestination | null = null
        if (type === "slack") {
            const organizationId = req.session.user.organizationId
            if (!organizationId) {
                res.status(400).json({ error: "Organization context is required" })
                return
            }
            const slackIntegration = await prisma.user_slack_integrations.findFirst({
                where: {
                    id: integrationId,
                    organization_id: organizationId
                },
                include: {
                    user: true,
                    slack_integration: true
                }
            })

            if (!slackIntegration) {
                res.status(403).json({ error: "Slack integration not found or not owned by user" })
                return
            }

            const normalizedSlackChannelId = normalizeOptionalString(slackChannelId)
            const normalizedSlackUserId = normalizeOptionalString(slackUserId)

            const hasChannelTarget = Boolean(normalizedSlackChannelId)
            const hasUserTarget = Boolean(normalizedSlackUserId)

            if (hasChannelTarget === hasUserTarget) {
                res.status(400).json({ error: "Exactly one Slack destination must be selected: either a channel or a user." })
                return
            }

            try {
                resolvedSlackDestination = await resolveSlackDestinationTarget({
                    slackIntegration,
                    slackChannelId: normalizedSlackChannelId,
                    slackChannelName: normalizeOptionalString(slackChannelName),
                    slackUserId: normalizedSlackUserId,
                    slackUserName: normalizeOptionalString(slackUserName)
                })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to resolve Slack destination"
                res.status(400).json({ error: errorMessage })
                return
            }
        }

        const destination = await prisma.user_notification_destinations.create({
            data: {
                user_id: userId,
                destination_type: type === "email" ? NotificationDestinationType.EMAIL : NotificationDestinationType.SLACK,
                email_address: type === "email" ? email : null,
                slack_integration_id: type === "slack" ? integrationId : null,
                slack_channel_id: type === "slack" ? resolvedSlackDestination?.slackChannelId : null,
                slack_channel_name: type === "slack" ? resolvedSlackDestination?.slackChannelName : null,
                slack_user_id: type === "slack" ? resolvedSlackDestination?.slackUserId : null,
                slack_user_name: type === "slack" ? resolvedSlackDestination?.slackUserName : null
            }
        })

        res.status(201).json(transformDestinationToFrontendFormat(destination))
    } catch (error) {
        logger.error("Error creating notification destination", { error, userId, type })
        res.status(500).json({ error: "Failed to create notification destination" })
    }
}

// PUT /notification-destinations/:id - Update an existing notification destination
export async function updateNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const destinationId = req.params.id
    const { type, email, integrationId, slackChannelId, slackChannelName, slackUserId, slackUserName, isActive } = req.body
    const requestBody = req.body as Record<string, unknown>

    try {
        const prisma = db()

        // Check if destination exists and belongs to user
        const existingDestination = await prisma.user_notification_destinations.findFirst({
            where: {
                id: destinationId,
                user_id: userId
            }
        })

        if (!existingDestination) {
            res.status(404).json({ error: "Notification destination not found" })
            return
        }

        const destinationType = type ?? (existingDestination.destination_type === NotificationDestinationType.SLACK ? "slack" : "email")

        const updateData: any = {
            ...(isActive !== undefined && { is_active: isActive })
        }

        if (destinationType === "email") {
            const nextEmail = email ?? existingDestination.email_address
            if (!nextEmail) {
                res.status(400).json({ error: "Invalid request: email is required for email destinations" })
                return
            }

            updateData.destination_type = NotificationDestinationType.EMAIL
            updateData.email_address = nextEmail
            updateData.slack_integration_id = null
            updateData.slack_channel_id = null
            updateData.slack_channel_name = null
            updateData.slack_user_id = null
            updateData.slack_user_name = null
        } else {
            const organizationId = req.session.user.organizationId
            if (!organizationId) {
                res.status(400).json({ error: "Organization context is required" })
                return
            }

            const integrationIdToUse = integrationId ?? existingDestination.slack_integration_id
            if (!integrationIdToUse) {
                res.status(400).json({ error: "Invalid request: integrationId is required for Slack destinations" })
                return
            }

            const hasSlackChannelIdInput = hasOwn(requestBody, "slackChannelId")
            const hasSlackUserIdInput = hasOwn(requestBody, "slackUserId")
            const hasSlackChannelNameInput = hasOwn(requestBody, "slackChannelName")
            const hasSlackUserNameInput = hasOwn(requestBody, "slackUserName")
            const hasExplicitTargetSelection = hasSlackChannelIdInput || hasSlackUserIdInput

            const normalizedSlackChannelId = hasExplicitTargetSelection ? normalizeOptionalString(slackChannelId) : normalizeOptionalString(existingDestination.slack_channel_id)
            const normalizedSlackUserId = hasExplicitTargetSelection ? normalizeOptionalString(slackUserId) : normalizeOptionalString(existingDestination.slack_user_id)
            const normalizedSlackChannelName =
                hasSlackChannelNameInput || hasExplicitTargetSelection ? normalizeOptionalString(slackChannelName) : normalizeOptionalString(existingDestination.slack_channel_name)
            const normalizedSlackUserName = hasSlackUserNameInput || hasExplicitTargetSelection ? normalizeOptionalString(slackUserName) : normalizeOptionalString(existingDestination.slack_user_name)

            const hasChannelTarget = Boolean(normalizedSlackChannelId)
            const hasUserTarget = Boolean(normalizedSlackUserId)
            if (hasChannelTarget === hasUserTarget) {
                res.status(400).json({ error: "Exactly one Slack destination must be selected: either a channel or a user." })
                return
            }

            const slackIntegration = await prisma.user_slack_integrations.findFirst({
                where: {
                    id: integrationIdToUse,
                    organization_id: organizationId
                },
                include: {
                    user: true,
                    slack_integration: true
                }
            })

            if (!slackIntegration) {
                res.status(403).json({ error: "Slack integration not found or not owned by user" })
                return
            }

            let resolvedSlackDestination: ResolvedSlackDestination
            try {
                resolvedSlackDestination = await resolveSlackDestinationTarget({
                    slackIntegration,
                    slackChannelId: normalizedSlackChannelId,
                    slackChannelName: normalizedSlackChannelName,
                    slackUserId: normalizedSlackUserId,
                    slackUserName: normalizedSlackUserName
                })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to resolve Slack destination"
                res.status(400).json({ error: errorMessage })
                return
            }

            updateData.destination_type = NotificationDestinationType.SLACK
            updateData.email_address = null
            updateData.slack_integration_id = integrationIdToUse
            updateData.slack_channel_id = resolvedSlackDestination.slackChannelId
            updateData.slack_channel_name = resolvedSlackDestination.slackChannelName
            updateData.slack_user_id = resolvedSlackDestination.slackUserId
            updateData.slack_user_name = resolvedSlackDestination.slackUserName
        }

        const updatedDestination = await prisma.user_notification_destinations.update({
            where: { id: destinationId },
            data: updateData
        })

        res.status(200).json(transformDestinationToFrontendFormat(updatedDestination))
    } catch (error) {
        logger.error("Error updating notification destination", { error, userId, destinationId })
        res.status(500).json({ error: "Failed to update notification destination" })
    }
}

// DELETE /notification-destinations/:id - Delete a notification destination
export async function deleteNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const destinationId = req.params.id

    try {
        const prisma = db()

        // Check if destination exists and belongs to user
        const existingDestination = await prisma.user_notification_destinations.findFirst({
            where: {
                id: destinationId,
                user_id: userId
            }
        })

        if (!existingDestination) {
            res.status(404).json({ error: "Notification destination not found" })
            return
        }

        await prisma.user_notification_destinations.delete({
            where: { id: destinationId }
        })

        res.status(204).send()
    } catch (error) {
        logger.error("Error deleting notification destination", { error, userId, destinationId })
        res.status(500).json({ error: "Failed to delete notification destination" })
    }
}

// Helper function to transform database model to frontend format
function transformDestinationToFrontendFormat(destination: UserNotificationDestination): EmailNotificationDestination | SlackNotificationDestination {
    if (destination.destination_type === NotificationDestinationType.EMAIL) {
        return {
            id: destination.id,
            type: SharedNotificationDestinationType.EMAIL,
            isActive: destination.is_active,
            email: destination.email_address ?? ""
        }
    } else {
        return {
            id: destination.id,
            type: SharedNotificationDestinationType.SLACK,
            isActive: destination.is_active,
            integrationId: destination.slack_integration_id ?? "",
            slackChannelId: destination.slack_channel_id ?? undefined,
            slackChannelName: destination.slack_channel_name ?? undefined,
            slackUserId: destination.slack_user_id ?? undefined,
            slackUserName: destination.slack_user_name ?? undefined
        }
    }
}

type ResolvedSlackDestination = {
    slackChannelId: string
    slackChannelName: string | null
    slackUserId: string | null
    slackUserName: string | null
}

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key)
}

async function resolveSlackDestinationTarget(params: {
    slackIntegration: UserSlackIntegrationWithUser
    slackChannelId?: string
    slackChannelName?: string
    slackUserId?: string
    slackUserName?: string
}): Promise<ResolvedSlackDestination> {
    const hasChannelTarget = Boolean(params.slackChannelId)
    const hasUserTarget = Boolean(params.slackUserId)

    if (hasChannelTarget === hasUserTarget) {
        throw new Error("Exactly one Slack destination must be selected: either a channel or a user.")
    }

    if (params.slackChannelId) {
        return {
            slackChannelId: params.slackChannelId,
            slackChannelName: params.slackChannelName ?? null,
            slackUserId: null,
            slackUserName: null
        }
    }

    const userId = params.slackUserId!
    const client = initializeSlackWebClient(params.slackIntegration)
    const result = await client.conversations.open({
        users: userId
    })

    const dmChannelId = result.channel?.id
    if (!dmChannelId) {
        throw new Error(`Unable to open a DM channel for Slack user ${userId}.`)
    }

    return {
        slackChannelId: dmChannelId,
        slackChannelName: params.slackUserName ?? userId,
        slackUserId: userId,
        slackUserName: params.slackUserName ?? null
    }
}
