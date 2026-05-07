import { Request, Response } from "express"
import type { SdkSampleEventRef as SampleEventRef, SdkSampleEventsResponse, User } from "terse-types"
import { sdkSampleEventsRequestSchema, sdkSampleEventsResponseSchema } from "terse-types/types"

import { fetchSampleEvents } from "../integrations/abstract/sampleEvents"
import logger from "../logger"
import { extractErrorMessage } from "../utility/strings"

export async function handleSampleEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const { jobName, projectId, triggers } = sdkSampleEventsRequestSchema.parse(req.body)

    const events: SampleEventRef[] = []
    const webhookEndpoints: NonNullable<SdkSampleEventsResponse["webhookEndpoints"]> = []

    for (const trigger of triggers) {
        const { triggerId, integrationId, integrationType, config } = trigger

        if (!integrationId || !integrationType) {
            logger.warn("[sample-events] Skipping trigger with missing fields", { trigger })
            continue
        }

        try {
            const result = await fetchSampleEvents({
                integrationId,
                integrationType,
                triggerConfig: config,
                organizationId: user.organizationId,
                userId: user.id,
                triggerId,
                jobName,
                projectId,
                limit: 5
            })
            events.push(...result.events)
            if (result.webhookEndpoints) webhookEndpoints.push(...result.webhookEndpoints)
        } catch (err) {
            logger.warn("[sample-events] Skipping trigger due to error", {
                integrationType,
                error: extractErrorMessage(err)
            })
        }
    }

    return res.json(sdkSampleEventsResponseSchema.parse({ events, webhookEndpoints: webhookEndpoints.length > 0 ? webhookEndpoints : undefined }))
}
