import { Request, Response } from "express"
import { IntegrationType, type SdkSampleEventRef as SampleEventRef, type SdkSampleEventsResponse, type SerializedEvent, type User } from "terse-types"
import { sdkHydrateSampleEventRequestSchema, sdkHydrateSampleEventResponseSchema, sdkSampleEventsRequestSchema, sdkSampleEventsResponseSchema } from "terse-types/types"

import logger from "../../../common/logger"
import { HydrationError } from "../../../hydrators/Hydrator"
import { requireHydrator } from "../../../hydrators/HydratorRegistry"
import { fetchSampleEvents } from "../../../integrations/abstract/sampleEvents"
import { requireHydratorType } from "../../../types/rag"
import { extractErrorMessage } from "../../../utility/strings"

export async function handleSampleEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    const { jobName, projectId, triggers } = sdkSampleEventsRequestSchema.parse(req.body)

    const events: SampleEventRef[] = []
    const webhookEndpoints: NonNullable<SdkSampleEventsResponse["webhookEndpoints"]> = []
    let webhookFetched = false

    for (const trigger of triggers) {
        const { triggerId, integrationId, integrationType, config } = trigger
        if (!integrationId || !integrationType) {
            logger.warn("[sample-events] Skipping trigger with missing fields", { trigger })
            continue
        }
        if (integrationType === IntegrationType.WEBHOOK) {
            if (webhookFetched) continue
            webhookFetched = true
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
            logger.warn("[sample-events] Skipping trigger due to error", { integrationType, error: extractErrorMessage(err) })
        }
    }

    return res.json(sdkSampleEventsResponseSchema.parse({ events, webhookEndpoints: webhookEndpoints.length > 0 ? webhookEndpoints : undefined }))
}

function hasSerializedEvent(value: unknown): value is { getSerializedEvent: () => SerializedEvent } {
    return !!value && typeof value === "object" && "getSerializedEvent" in value
}

export async function handleHydrateSampleEvent(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    const { entityType, entityId } = sdkHydrateSampleEventRequestSchema.parse(req.body)
    const hydratorType = requireHydratorType(entityType)
    const hydrator = requireHydrator(hydratorType, { userId: user.id, organizationId: user.organizationId })

    try {
        const runtime = await hydrator.hydrate({ entityType: hydratorType, entityId })
        if (!hasSerializedEvent(runtime)) {
            throw new Error(`Hydrator ${entityType} does not produce serialized events`)
        }
        const payload = sdkHydrateSampleEventResponseSchema.parse({ event: runtime.getSerializedEvent() })
        return res.json(payload)
    } catch (error) {
        if (error instanceof HydrationError) return res.status(error.status).json({ error: error.message })
        throw error
    }
}
