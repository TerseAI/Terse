import { Request, Response } from "express"
import type { SerializedEvent, User } from "terse-types"
import { sdkHydrateSampleEventRequestSchema, sdkHydrateSampleEventResponseSchema } from "terse-types/types"

import { HydrationError } from "../hydrators/Hydrator"
import { requireHydrator } from "../hydrators/HydratorRegistry"
import { requireHydratorType } from "../types/rag"

export async function handleHydrateSampleEvent(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

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
        if (error instanceof HydrationError) {
            return res.status(error.status).json({ error: error.message })
        }
        throw error
    }
}

function hasSerializedEvent(value: unknown): value is { getSerializedEvent: () => SerializedEvent } {
    return !!value && typeof value === "object" && "getSerializedEvent" in value
}
