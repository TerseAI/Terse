import { Request, Response } from "express"
import { createNotificationDestinationRequestSchema, updateNotificationDestinationRequestSchema } from "terse-types/Notifications"

import logger from "../../../common/logger"
import {
    DestinationNotFoundError,
    InvalidDestinationError,
    SlackIntegrationNotFoundError,
    createDestinationForUser,
    deleteDestinationForUser,
    listDestinationsForUser,
    transformDestinationToFrontendFormat,
    updateDestinationForUser
} from "./service"

export async function getNotificationDestinations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    try {
        const items = await listDestinationsForUser(userId)
        res.status(200).json(items)
    } catch (error) {
        logger.error("Error fetching notification destinations", { error, userId })
        res.status(500).json({ error: "Failed to fetch notification destinations" })
    }
}

export async function createNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    const parsed = createNotificationDestinationRequestSchema.parse(req.body)
    try {
        const destination = await createDestinationForUser({
            userId,
            organizationId: req.session.user.organizationId,
            type: parsed.type,
            email: parsed.email,
            integrationId: parsed.integrationId,
            slackChannelId: parsed.slackChannelId,
            slackChannelName: parsed.slackChannelName,
            slackUserId: parsed.slackUserId,
            slackUserName: parsed.slackUserName
        })
        res.status(201).json(transformDestinationToFrontendFormat(destination))
    } catch (error) {
        if (error instanceof InvalidDestinationError) return res.status(400).json({ error: error.message })
        if (error instanceof SlackIntegrationNotFoundError) return res.status(403).json({ error: error.message })
        logger.error("Error creating notification destination", { error, userId, type: parsed.type })
        res.status(500).json({ error: "Failed to create notification destination" })
    }
}

export async function updateNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    const destinationId = req.params.id
    const parsed = updateNotificationDestinationRequestSchema.parse(req.body)
    try {
        const updated = await updateDestinationForUser({
            userId,
            organizationId: req.session.user.organizationId,
            destinationId,
            type: parsed.type,
            email: parsed.email,
            integrationId: parsed.integrationId,
            slackChannelId: parsed.slackChannelId,
            slackChannelName: parsed.slackChannelName,
            slackUserId: parsed.slackUserId,
            slackUserName: parsed.slackUserName,
            isActive: parsed.isActive,
            requestBody: req.body as Record<string, unknown>
        })
        res.status(200).json(transformDestinationToFrontendFormat(updated))
    } catch (error) {
        if (error instanceof DestinationNotFoundError) return res.status(404).json({ error: error.message })
        if (error instanceof InvalidDestinationError) return res.status(400).json({ error: error.message })
        if (error instanceof SlackIntegrationNotFoundError) return res.status(403).json({ error: error.message })
        logger.error("Error updating notification destination", { error, userId, destinationId })
        res.status(500).json({ error: "Failed to update notification destination" })
    }
}

export async function deleteNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const userId = req.session.user.id
    const destinationId = req.params.id
    try {
        await deleteDestinationForUser(destinationId, userId, req.session.user.organizationId)
        res.status(204).send()
    } catch (error) {
        if (error instanceof DestinationNotFoundError) return res.status(404).json({ error: error.message })
        logger.error("Error deleting notification destination", { error, userId, destinationId })
        res.status(500).json({ error: "Failed to delete notification destination" })
    }
}
