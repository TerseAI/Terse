import { Request, Response } from "express"
import type { SdkSampleEventRef as SampleEventRef, User } from "terse-types"
import { sdkSampleEventsRequestSchema, sdkSampleEventsResponseSchema } from "terse-types/types"

import { fetchSampleEvents } from "../integrations/abstract/sampleEvents"
import logger from "../logger"
import { extractErrorMessage } from "../utility/strings"

export async function handleSampleEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const { triggers } = sdkSampleEventsRequestSchema.parse(req.body)

    const events: SampleEventRef[] = []

    for (const trigger of triggers) {
        const { triggerId, integrationId, integrationType, config } = trigger

        if (!integrationId || !integrationType) {
            logger.warn("[sample-events] Skipping trigger with missing fields", { trigger })
            continue
        }

        try {
            const inputEvents = await fetchSampleEvents(integrationId, integrationType, config, user.organizationId, user.id, { limit: 5, triggerId })

            for (const evt of inputEvents) {
                const identifiable = evt.getIdentifiableInfo()
                if (!identifiable) {
                    logger.warn("[sample-events] Skipping non-hydratable sample runtime", {
                        integrationType,
                        eventType: evt.eventType
                    })
                    continue
                }
                const serialized = evt.getSerializedEvent()
                events.push({
                    entity: identifiable,
                    serializedEvent: serialized
                })
            }
        } catch (err) {
            // Skip integrations that don't support sample events or that error
            logger.warn("[sample-events] Skipping trigger due to error", {
                integrationType,
                error: extractErrorMessage(err)
            })
        }
    }

    return res.json(sdkSampleEventsResponseSchema.parse({ events }))
}
