import { Request, Response } from "express"

import { SdkAgentRunRequestBody, SdkAgentRunResponseBody, SdkAgentStreamEvent, User } from "../shared/types"

import { validateAndNormalizeSdkAgentRunBody } from "./sdkAgentRunValidation"

/**
 * POST /sdk/agent-run
 *
 * Placeholder route for SDK-driven full agent loop execution.
 * We wire this endpoint first, then implement execution in follow-up chunks.
 */
export async function handleSdkAgentRun(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const body = req.body as SdkAgentRunRequestBody
    const validation = validateAndNormalizeSdkAgentRunBody(body)
    if (!validation.ok) {
        const response: SdkAgentRunResponseBody = {
            success: false,
            error: "Invalid request body",
            details: validation.errors
        }
        return res.status(400).json(response)
    }

    const normalized = validation.normalized

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const send = (event: SdkAgentStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    send({
        type: "text",
        text: `Starting run for ${normalized.event.integrationType} event...`
    })
    send({
        type: "text",
        text: "SSE transport connected. Full AgentRunner integration is next."
    })
    send({ type: "done" })
    return res.end()
}
