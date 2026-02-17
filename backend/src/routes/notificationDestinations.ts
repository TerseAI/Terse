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

const EXACTLY_ONE_SLACK_TARGET_ERROR = "Exactly one Slack destination must be selected: either a channel or a user."
const NOTIFICATION_DESTINATIONS_INVALIDATION_KEY = notificationDestinationsKey()[0]

type UpdateNotificationDestinationRequest = Partial<CreateNotificationDestinationRequest> & {
    isActive?: boolean
}

type SlackTargetSelection =
    | {
          targetType: "channel"
          slackChannelId: string
          slackChannelName?: string
      }
    | {
          targetType: "user"
          slackUserId: string
          slackUserName?: string
      }

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

    if (!type) {
        res.status(400).json({ error: "Invalid request: type is required" })
        return
    }

    try {
        const prisma = db()

        if (type === "email" && !email) {
            res.status(400).json({ error: "Invalid request: email is required for email destinations" })
            return
        }

        const normalizedIntegrationId = normalizeOptionalString(integrationId)
        if (type === "slack" && !normalizedIntegrationId) {
            res.status(400).json({ error: "Invalid request: integrationId is required for Slack destinations" })
            return
        }

        let resolvedSlackDestination: ResolvedSlackDestination | null = null
        if (type === "slack") {
            const organizationId = req.session.user.organizationId
            if (!organizationId) {
                res.status(400).json({ error: "Organization context is required" })
                return
            }

            const slackIntegration = await findSlackIntegrationForOrganization(prisma, normalizedIntegrationId!, organizationId)
            if (!slackIntegration) {
                res.status(403).json({ error: "Slack integration not found or not owned by user" })
                return
            }

            try {
                const slackTargetSelection = parseSlackTargetSelection({
                    slackChannelId: normalizeOptionalString(slackChannelId),
                    slackChannelName: normalizeOptionalString(slackChannelName),
                    slackUserId: normalizeOptionalString(slackUserId),
                    slackUserName: normalizeOptionalString(slackUserName)
                })
                resolvedSlackDestination = await resolveSlackDestinationTarget({
                    slackIntegration,
                    targetSelection: slackTargetSelection
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
                slack_integration_id: type === "slack" ? (normalizedIntegrationId ?? null) : null,
                slack_channel_id: type === "slack" ? resolvedSlackDestination?.slackChannelId : null,
                slack_channel_name: type === "slack" ? resolvedSlackDestination?.slackChannelName : null,
                slack_user_id: type === "slack" ? resolvedSlackDestination?.slackUserId : null,
                slack_user_name: type === "slack" ? resolvedSlackDestination?.slackUserName : null
            }
        })

        invalidateNotificationDestinations(req.session.user.organizationId)
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
    const requestBody = req.body as UpdateNotificationDestinationRequest & Record<string, unknown>
    const { type, email, integrationId, slackChannelId, slackChannelName, slackUserId, slackUserName, isActive } = requestBody

    try {
        const prisma = db()

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
        const updateData: any = {}
        if (isActive !== undefined) {
            updateData.is_active = isActive
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
            const integrationIdToUse = normalizeOptionalString(integrationId) ?? normalizeOptionalString(existingDestination.slack_integration_id)
            if (!integrationIdToUse) {
                res.status(400).json({ error: "Invalid request: integrationId is required for Slack destinations" })
                return
            }

            const hasSlackChannelIdInput = hasOwn(requestBody, "slackChannelId")
            const hasSlackUserIdInput = hasOwn(requestBody, "slackUserId")
            const hasSlackChannelNameInput = hasOwn(requestBody, "slackChannelName")
            const hasSlackUserNameInput = hasOwn(requestBody, "slackUserName")
            const hasExplicitTargetSelection = hasSlackChannelIdInput || hasSlackUserIdInput
            const isExistingSlackDestination = existingDestination.destination_type === NotificationDestinationType.SLACK
            const integrationChanged = integrationIdToUse !== existingDestination.slack_integration_id
            const shouldResolveSlackTarget = !isExistingSlackDestination || hasExplicitTargetSelection || integrationChanged || hasSlackChannelNameInput || hasSlackUserNameInput

            let resolvedSlackDestination: ResolvedSlackDestination
            if (shouldResolveSlackTarget) {
                const organizationId = req.session.user.organizationId
                if (!organizationId) {
                    res.status(400).json({ error: "Organization context is required" })
                    return
                }

                const slackIntegration = await findSlackIntegrationForOrganization(prisma, integrationIdToUse, organizationId)
                if (!slackIntegration) {
                    res.status(403).json({ error: "Slack integration not found or not owned by user" })
                    return
                }

                let slackTargetSelection: SlackTargetSelection
                try {
                    slackTargetSelection = hasExplicitTargetSelection
                        ? parseSlackTargetSelection({
                              slackChannelId: hasSlackChannelIdInput ? normalizeOptionalString(slackChannelId) : undefined,
                              slackChannelName: hasSlackChannelNameInput ? normalizeOptionalString(slackChannelName) : undefined,
                              slackUserId: hasSlackUserIdInput ? normalizeOptionalString(slackUserId) : undefined,
                              slackUserName: hasSlackUserNameInput ? normalizeOptionalString(slackUserName) : undefined
                          })
                        : getSlackTargetSelectionFromStoredDestination(existingDestination)
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to resolve Slack destination"
                    res.status(400).json({ error: errorMessage })
                    return
                }

                try {
                    resolvedSlackDestination = await resolveSlackDestinationTarget({
                        slackIntegration,
                        targetSelection: slackTargetSelection
                    })
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to resolve Slack destination"
                    res.status(400).json({ error: errorMessage })
                    return
                }
            } else {
                try {
                    resolvedSlackDestination = getResolvedSlackDestinationFromStoredDestination(existingDestination)
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to resolve Slack destination"
                    res.status(400).json({ error: errorMessage })
                    return
                }
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

        invalidateNotificationDestinations(req.session.user.organizationId)
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

        invalidateNotificationDestinations(req.session.user.organizationId)
        res.status(204).send()
    } catch (error) {
        logger.error("Error deleting notification destination", { error, userId, destinationId })
        res.status(500).json({ error: "Failed to delete notification destination" })
    }
}

function transformDestinationToFrontendFormat(destination: UserNotificationDestination): EmailNotificationDestination | SlackNotificationDestination {
    if (destination.destination_type === NotificationDestinationType.EMAIL) {
        return {
            id: destination.id,
            type: SharedNotificationDestinationType.EMAIL,
            isActive: destination.is_active,
            email: destination.email_address ?? ""
        }
    }

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

function parseSlackTargetSelection(params: { slackChannelId?: string; slackChannelName?: string; slackUserId?: string; slackUserName?: string }): SlackTargetSelection {
    const hasChannelTarget = Boolean(params.slackChannelId)
    const hasUserTarget = Boolean(params.slackUserId)

    if (hasChannelTarget === hasUserTarget) {
        throw new Error(EXACTLY_ONE_SLACK_TARGET_ERROR)
    }

    if (params.slackChannelId) {
        return {
            targetType: "channel",
            slackChannelId: params.slackChannelId,
            slackChannelName: params.slackChannelName
        }
    }

    return {
        targetType: "user",
        slackUserId: params.slackUserId!,
        slackUserName: params.slackUserName
    }
}

function getSlackTargetSelectionFromStoredDestination(destination: UserNotificationDestination): SlackTargetSelection {
    const storedSlackUserId = normalizeOptionalString(destination.slack_user_id)
    if (storedSlackUserId) {
        return {
            targetType: "user",
            slackUserId: storedSlackUserId,
            slackUserName: normalizeOptionalString(destination.slack_user_name)
        }
    }

    const storedSlackChannelId = normalizeOptionalString(destination.slack_channel_id)
    if (storedSlackChannelId) {
        return {
            targetType: "channel",
            slackChannelId: storedSlackChannelId,
            slackChannelName: normalizeOptionalString(destination.slack_channel_name)
        }
    }

    throw new Error(EXACTLY_ONE_SLACK_TARGET_ERROR)
}

function getResolvedSlackDestinationFromStoredDestination(destination: UserNotificationDestination): ResolvedSlackDestination {
    const slackChannelId = normalizeOptionalString(destination.slack_channel_id)
    if (!slackChannelId) {
        throw new Error(EXACTLY_ONE_SLACK_TARGET_ERROR)
    }

    return {
        slackChannelId,
        slackChannelName: normalizeOptionalString(destination.slack_channel_name) ?? null,
        slackUserId: normalizeOptionalString(destination.slack_user_id) ?? null,
        slackUserName: normalizeOptionalString(destination.slack_user_name) ?? null
    }
}

async function findSlackIntegrationForOrganization(prisma: ReturnType<typeof db>, integrationId: string, organizationId: string): Promise<UserSlackIntegrationWithUser | null> {
    return prisma.user_slack_integrations.findFirst({
        where: {
            id: integrationId,
            organization_id: organizationId
        },
        include: {
            user: true,
            slack_integration: true
        }
    })
}

function invalidateNotificationDestinations(organizationId: string | null | undefined): void {
    if (!organizationId) return
    emitCacheInvalidationWithKey(organizationId, NOTIFICATION_DESTINATIONS_INVALIDATION_KEY)
}

async function resolveSlackDestinationTarget(params: { slackIntegration: UserSlackIntegrationWithUser; targetSelection: SlackTargetSelection }): Promise<ResolvedSlackDestination> {
    if (params.targetSelection.targetType === "channel") {
        return {
            slackChannelId: params.targetSelection.slackChannelId,
            slackChannelName: params.targetSelection.slackChannelName ?? null,
            slackUserId: null,
            slackUserName: null
        }
    }

    const userId = params.targetSelection.slackUserId
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
        slackChannelName: params.targetSelection.slackUserName ?? userId,
        slackUserId: userId,
        slackUserName: params.targetSelection.slackUserName ?? null
    }
}
