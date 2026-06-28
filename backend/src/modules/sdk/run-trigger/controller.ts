import { Request, Response } from "express"
import { SdkRunTriggerEventResponse } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { parseSerializedTriggerPayload } from "../../../common/triggerPayload"
import { db } from "../../../loaders/prisma"

export async function handleSdkRunTriggerEvent(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    const organizationId = user.organizationId
    if (!organizationId) return res.status(400).json({ error: "Organization context is required" })

    const runId = req.params.runId?.trim()
    if (!runId) return res.status(400).json({ error: "runId is required" })

    let result: SdkRunTriggerEventResponse | null
    try {
        result = await fetchEventFromRunId(runId, organizationId)
    } catch (error) {
        logger.error("[sdk/run-trigger-event] Failed to fetch trigger event", { runId, organizationId, error: extractErrorMessage(error) })
        return res.status(500).json({ error: "Failed to fetch trigger event" })
    }

    if (!result) return res.status(404).json({ error: "Trigger event not available for this run" })
    return res.json(result)
}

export async function fetchEventFromRunId(runId: string, organizationId: string): Promise<SdkRunTriggerEventResponse | null> {
    const runRecord = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: { trigger_payload: true, is_test: true, automation: { select: { name: true } } }
    })

    if (!runRecord) return null

    const event = parseSerializedTriggerPayload(runRecord.trigger_payload)
    if (!event) return null

    return { event, agentName: runRecord.automation.name, isTest: runRecord.is_test }
}
