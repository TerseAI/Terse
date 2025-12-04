import { Request, Response } from "express";
import { db } from "../prismaClient";
import { NotificationDestinationType } from "@prisma/client";
import { CreateNotificationDestinationRequest } from "../shared/Notifications";
import { emitCacheInvalidationWithKey } from "../realtimeSocket";
import { notificationDestinationsKey } from "../shared/InvalidationKeys";

// GET /notification-destinations - List all notification destinations for the user
export async function getNotificationDestinations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    try {
        const destinations = await db().user_notification_destinations.findMany({
            where: {
                user_id: userId,
            },
            orderBy: { created_at: 'desc' }
        });

        // Transform to frontend format
        const response = destinations.map(dest => transformDestinationToFrontendFormat(dest));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching notification destinations:', error);
        res.status(500).json({ error: 'Failed to fetch notification destinations' });
    }
}

// POST /notification-destinations - Create a new notification destination
export async function createNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const { type, email, integrationId, slackChannelId, slackChannelName }: CreateNotificationDestinationRequest = req.body;

    // Validate request
    if (!type) {
        res.status(400).json({ error: 'Invalid request: type is required' });
        return;
    }

    try {
        const prisma = db();

        // Validate based on type
        if (type === 'email' && !email) {
            res.status(400).json({ error: 'Invalid request: email is required for email destinations' });
            return;
        }

        if (type === 'slack' && !integrationId) {
            res.status(400).json({ error: 'Invalid request: integrationId is required for Slack destinations' });
            return;
        }

        // For Slack, validate that user owns the integration
        if (type === 'slack') {
            const slackIntegration = await prisma.user_slack_integrations.findFirst({
                where: {
                    user_id: userId,
                    id: integrationId
                }
            });

            if (!slackIntegration) {
                res.status(403).json({ error: 'Slack integration not found or not owned by user' });
                return;
            }
        }

        const destination = await prisma.user_notification_destinations.create({
            data: {
                user_id: userId,
                destination_type: type === 'email' ? NotificationDestinationType.EMAIL : NotificationDestinationType.SLACK,
                email_address: type === 'email' ? email : null,
                slack_integration_id: type === 'slack' ? integrationId : null,
                slack_channel_id: type === 'slack' ? slackChannelId : null,
                slack_channel_name: type === 'slack' ? slackChannelName : null,
            }
        });

        res.status(201).json(transformDestinationToFrontendFormat(destination));
    } catch (error) {
        console.error('Error creating notification destination:', error);
        res.status(500).json({ error: 'Failed to create notification destination' });
    }
}

// PUT /notification-destinations/:id - Update an existing notification destination
export async function updateNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const destinationId = req.params.id;
    const { type, email, integrationId, slackChannelId, slackChannelName, isActive } = req.body;

    try {
        const prisma = db();

        // Check if destination exists and belongs to user
        const existingDestination = await prisma.user_notification_destinations.findFirst({
            where: {
                id: destinationId,
                user_id: userId
            }
        });

        if (!existingDestination) {
            res.status(404).json({ error: 'Notification destination not found' });
            return;
        }

        // For Slack, validate that user owns the integration if integrationId is being updated
        if (type === 'slack' && integrationId) {
            const slackIntegration = await prisma.user_slack_integrations.findFirst({
                where: {
                    user_id: userId,
                    slack_integration: {
                        id: integrationId
                    }
                }
            });

            if (!slackIntegration) {
                res.status(403).json({ error: 'Slack integration not found or not owned by user' });
                return;
            }
        }

        const updatedDestination = await prisma.user_notification_destinations.update({
            where: { id: destinationId },
            data: {
                ...(type && { destination_type: type === 'email' ? NotificationDestinationType.EMAIL : NotificationDestinationType.SLACK }),
                ...(email !== undefined && { email_address: email }),
                ...(integrationId !== undefined && { slack_integration_id: integrationId }),
                ...(slackChannelId !== undefined && { slack_channel_id: slackChannelId }),
                ...(slackChannelName !== undefined && { slack_channel_name: slackChannelName }),
                ...(isActive !== undefined && { is_active: isActive }),
            }
        });

        res.status(200).json(transformDestinationToFrontendFormat(updatedDestination));
    } catch (error) {
        console.error('Error updating notification destination:', error);
        res.status(500).json({ error: 'Failed to update notification destination' });
    }
}

// DELETE /notification-destinations/:id - Delete a notification destination
export async function deleteNotificationDestination(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;
    const destinationId = req.params.id;

    try {
        const prisma = db();

        // Check if destination exists and belongs to user
        const existingDestination = await prisma.user_notification_destinations.findFirst({
            where: {
                id: destinationId,
                user_id: userId
            }
        });

        if (!existingDestination) {
            res.status(404).json({ error: 'Notification destination not found' });
            return;
        }

        await prisma.user_notification_destinations.delete({
            where: { id: destinationId }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting notification destination:', error);
        res.status(500).json({ error: 'Failed to delete notification destination' });
    }
}

// Helper function to transform database model to frontend format
function transformDestinationToFrontendFormat(destination: {
    id: string;
    destination_type: NotificationDestinationType;
    email_address: string | null;
    slack_integration_id: string | null;
    slack_channel_id: string | null;
    slack_channel_name: string | null;
    is_active: boolean;
}) {
    const base = {
        id: destination.id,
        type: destination.destination_type === NotificationDestinationType.EMAIL ? 'email' : 'slack',
        isActive: destination.is_active,
    };

    if (destination.destination_type === NotificationDestinationType.EMAIL) {
        return {
            ...base,
            email: destination.email_address,
        };
    } else {
        return {
            ...base,
            integrationId: destination.slack_integration_id,
            slackChannelId: destination.slack_channel_id,
            slackChannelName: destination.slack_channel_name,
        };
    }
}

