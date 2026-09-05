import { Request, Response } from "express"
import { type GetRunHistoryResponse } from "terse-types/RunHistoryTypes"

import logger from "../../common/logger"
import { parsePageParams } from "../../common/pagination"
import { extractErrorMessage } from "../../common/strings"

import {
    AgentNotFoundError,
    RunNotFoundError,
    RunNotRetryableError,
    fetchActionsByIds,
    fetchChatHistoryForRun,
    listAllRunHistory,
    listRunHistoryForAgent,
    parseGetRunHistoryParams,
    retryFailedRunFromJournal
} from "./service"

export async function getAllRunHistory(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) return res.status(401).json({ error: "Unauthorized" })
        const organizationId = user.organizationId
        if (!organizationId) return res.status(400).json({ error: "Organization context is required" })

        const params = parseGetRunHistoryParams(req.query)
        const { page, pageSize, skip, take } = parsePageParams(req, 20, 100)
        const { items, total } = await listAllRunHistory(organizationId, params, skip, take)

        res.json({ items, page, pageSize, total })
    } catch (err) {
        logger.error("Failed to fetch all run history", { error: extractErrorMessage(err), stack: err instanceof Error ? err.stack : undefined })
        res.status(500).json({ error: "Failed to fetch run history" })
    }
}

export async function getRunHistory(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) return res.status(401).json({ error: "Unauthorized" })
        const organizationId = user.organizationId
        if (!organizationId) return res.status(400).json({ error: "Organization context is required" })

        const agentId = (req.params.agentId as string | undefined)?.trim()
        if (!agentId) return res.status(400).json({ error: "channelId is required" })

        const params = parseGetRunHistoryParams(req.query)
        const { page, pageSize, skip, take } = parsePageParams(req, 20, 100)
        const { items, total } = await listRunHistoryForAgent(agentId, organizationId, params, skip, take)

        const response: GetRunHistoryResponse = { items, page, pageSize, total }
        res.json(response)
    } catch (err) {
        if (err instanceof AgentNotFoundError) {
            return res.status(404).json({ error: "Agent not found" })
        }
        logger.error("Failed to fetch run history", { error: extractErrorMessage(err), stack: err instanceof Error ? err.stack : undefined, agentId: req.params.agentId })
        res.status(500).json({ error: "Failed to fetch run history" })
    }
}

export async function getChatHistory(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user?.organizationId) return res.status(401).json({ error: "Unauthorized" })

        const runId = (req.params.runId as string | undefined)?.trim()
        if (!runId) return res.status(400).json({ error: "runId is required" })

        const result = await fetchChatHistoryForRun(runId, user.organizationId)
        res.json(result)
    } catch (err) {
        if (err instanceof RunNotFoundError) {
            return res.status(404).json({ error: "Run not found" })
        }
        logger.error("Failed to fetch chat history", { error: extractErrorMessage(err), stack: err instanceof Error ? err.stack : undefined, runId: req.params.runId })
        res.status(500).json({ error: "Failed to fetch chat history" })
    }
}

export async function getRunHistoryActions(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user?.organizationId) return res.status(401).json({ error: "Unauthorized" })

        const idsParam = (req.query.ids as string | undefined)?.trim()
        if (!idsParam) return res.status(400).json({ error: "ids query parameter is required" })

        const ids = idsParam
            .split(",")
            .map(id => id.trim())
            .filter(Boolean)

        const result = await fetchActionsByIds(ids, user.organizationId)
        res.json(result)
    } catch (err) {
        logger.error("Failed to fetch run history actions", { error: extractErrorMessage(err), stack: err instanceof Error ? err.stack : undefined, ids: req.query.ids })
        res.status(500).json({ error: "Failed to fetch run history actions" })
    }
}

export async function retryFailedRun(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user?.organizationId) return res.status(401).json({ error: "Unauthorized" })

        const runId = (req.params.runId as string | undefined)?.trim()
        if (!runId) return res.status(400).json({ error: "runId is required" })

        await retryFailedRunFromJournal(runId, user.organizationId)
        res.status(202).json({ accepted: true })
    } catch (err) {
        if (err instanceof RunNotFoundError) return res.status(404).json({ error: "Run not found" })
        if (err instanceof RunNotRetryableError) return res.status(409).json({ error: err.message })
        logger.error("Failed to retry run", { error: extractErrorMessage(err), stack: err instanceof Error ? err.stack : undefined, runId: req.params.runId })
        res.status(500).json({ error: "Failed to retry run" })
    }
}
