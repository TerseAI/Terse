import { Request, Response } from "express"
import type { SerializedEvent, User } from "terse-types"
import { sdkHydrateSampleEventRequestSchema, sdkHydrateSampleEventResponseSchema } from "terse-types/types"

import { db } from "../prismaClient"
import { requireHydrator } from "../rag/HydratorRegistry"
import { requireHydratorType } from "../types/rag"

export async function handleHydrateSampleEvent(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const { entityType, entityId } = sdkHydrateSampleEventRequestSchema.parse(req.body)
    const authorizationError = await getHydrationAuthorizationError(user, entityType, entityId)
    if (authorizationError) {
        return res.status(authorizationError.status).json({ error: authorizationError.error })
    }

    const hydratorType = requireHydratorType(entityType)
    const hydrator = requireHydrator(hydratorType, { userId: user.id, organizationId: user.organizationId })
    const runtime = await hydrator.hydrate({ entityType: hydratorType, entityId })
    if (!hasSerializedEvent(runtime)) {
        throw new Error(`Hydrator ${entityType} does not produce serialized events`)
    }
    const payload = sdkHydrateSampleEventResponseSchema.parse({ event: runtime.getSerializedEvent() })
    return res.json(payload)
}

function hasSerializedEvent(value: unknown): value is { getSerializedEvent: () => SerializedEvent } {
    return !!value && typeof value === "object" && "getSerializedEvent" in value
}

type HydrationAuthorizationError = {
    status: 400 | 403
    error: string
}

async function getHydrationAuthorizationError(user: User, entityType: string, entityId: string): Promise<HydrationAuthorizationError | null> {
    if (entityType !== "webmonitor_event") {
        return null
    }

    const monitorId = parseWebMonitorMonitorId(entityId)
    if (!monitorId) {
        return {
            status: 400,
            error: "Invalid web monitor entity id"
        }
    }

    const hasAccess = await db().automation_webmonitor_configs.findFirst({
        where: {
            provider_monitor_id: monitorId,
            automation_input: {
                automation: {
                    organization_id: user.organizationId
                }
            }
        },
        select: { id: true }
    })

    if (!hasAccess) {
        return {
            status: 403,
            error: "Forbidden"
        }
    }

    return null
}

function parseWebMonitorMonitorId(entityId: string): string | null {
    const parts = entityId.split(":")
    if (parts.length < 3) {
        return null
    }

    const monitorId = parts[0]?.trim()
    return monitorId ? monitorId : null
}
