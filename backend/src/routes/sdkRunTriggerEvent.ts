import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { serializedEventSchema } from "terse-types"

import logger from "../logger"
import { db } from "../prismaClient"
import { extractErrorMessage } from "../utility/strings"

function parseSerializedTriggerPayload(payload: Prisma.JsonValue | null) {
    if (payload === null) {
        return null
    }

    const rawPayload = typeof payload === "string" ? JSON.parse(payload) : payload
    return serializedEventSchema.parse(rawPayload)
}

export async function handleSdkRunTriggerEvent(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const organizationId = user.organizationId
    if (!organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    const runId = req.params.runId?.trim()
    if (!runId) {
        return res.status(400).json({ error: "runId is required" })
    }

    try {
        const runRecord = await db().run_history_records.findFirst({
            where: {
                id: runId,
                automation: {
                    organization_id: organizationId
                }
            },
            select: {
                trigger_payload: true
            }
        })

        if (!runRecord) {
            return res.status(404).json({ error: "Run not found" })
        }

        const event = parseSerializedTriggerPayload(runRecord.trigger_payload)
        if (!event) {
            return res.status(404).json({ error: "Trigger event not available for this run" })
        }

        return res.json({ event })
    } catch (error) {
        logger.error("[sdk/run-trigger-event] Failed to fetch trigger event", {
            runId,
            organizationId,
            error: extractErrorMessage(error)
        })
        return res.status(500).json({ error: "Failed to fetch trigger event" })
    }
}
