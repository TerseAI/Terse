import { Request, Response } from "express"
import { ApplyImprovementResponse, DismissImprovementResponse, ToggleImprovementsEnabledResponse } from "terse-types/types"
import { agentAndImprovementParamsSchema, agentIdParamsSchema, toggleImprovementsEnabledRequestSchema } from "terse-types/types"

import logger from "../../common/logger"

import {
    AgentNotFoundError,
    ImprovementConflictError,
    ImprovementNotFoundError,
    applyImprovementForAgent,
    dismissImprovementForAgent,
    listImprovementsForAgent,
    toggleImprovementsEnabledForAgent,
    undoDismissImprovementForAgent
} from "./service"

function requireAuthUser(req: Request, res: Response): { userId: string; organizationId: string } | null {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ error: "Unauthorized" })
        return null
    }
    if (!user.organizationId) {
        res.status(400).json({ error: "Organization context is required" })
        return null
    }
    return { userId: user.id, organizationId: user.organizationId }
}

function mapError(error: unknown, res: Response, logMessage: string, logContext: Record<string, unknown>): Response | undefined {
    if (error instanceof AgentNotFoundError) return res.status(404).json({ error: error.message })
    if (error instanceof ImprovementNotFoundError) return res.status(404).json({ error: error.message })
    if (error instanceof ImprovementConflictError) return res.status(409).json({ error: error.message })
    logger.error(logMessage, { error, ...logContext })
    return res.status(500).json({ error: logMessage })
}

export async function getAgentImprovements(req: Request, res: Response) {
    const auth = requireAuthUser(req, res)
    if (!auth) return
    const { agentId } = agentIdParamsSchema.parse(req.params)
    try {
        const response = await listImprovementsForAgent(agentId, auth.organizationId)
        res.status(200).json(response)
    } catch (error) {
        return mapError(error, res, "Failed to fetch improvements", { agentId, organizationId: auth.organizationId })
    }
}

export async function applyImprovement(req: Request, res: Response) {
    const auth = requireAuthUser(req, res)
    if (!auth) return
    const { agentId, id: improvementId } = agentAndImprovementParamsSchema.parse(req.params)
    try {
        const result = await applyImprovementForAgent(improvementId, agentId, auth.organizationId)
        const response: ApplyImprovementResponse = { success: true, appliedPrompt: result.appliedPrompt }
        res.status(200).json(response)
    } catch (error) {
        return mapError(error, res, "Failed to apply improvement", { agentId, improvementId, organizationId: auth.organizationId })
    }
}

export async function dismissImprovement(req: Request, res: Response) {
    const auth = requireAuthUser(req, res)
    if (!auth) return
    const { agentId, id: improvementId } = agentAndImprovementParamsSchema.parse(req.params)
    try {
        await dismissImprovementForAgent(improvementId, agentId, auth.organizationId)
        const response: DismissImprovementResponse = { success: true }
        res.status(200).json(response)
    } catch (error) {
        return mapError(error, res, "Failed to dismiss improvement", { agentId, improvementId, organizationId: auth.organizationId })
    }
}

export async function undoDismissImprovement(req: Request, res: Response) {
    const auth = requireAuthUser(req, res)
    if (!auth) return
    const { agentId, id: improvementId } = agentAndImprovementParamsSchema.parse(req.params)
    try {
        await undoDismissImprovementForAgent(improvementId, agentId, auth.organizationId)
        res.status(200).json({ success: true })
    } catch (error) {
        return mapError(error, res, "Failed to undo dismiss improvement", { agentId, improvementId, organizationId: auth.organizationId })
    }
}

export async function toggleImprovementsEnabled(req: Request, res: Response) {
    const auth = requireAuthUser(req, res)
    if (!auth) return
    const { agentId } = agentIdParamsSchema.parse(req.params)
    const { enabled } = toggleImprovementsEnabledRequestSchema.parse(req.body)
    try {
        await toggleImprovementsEnabledForAgent(agentId, auth.organizationId, enabled)
        const response: ToggleImprovementsEnabledResponse = { success: true, improvementsEnabled: enabled }
        res.status(200).json(response)
    } catch (error) {
        return mapError(error, res, "Failed to update improvements setting", { agentId, organizationId: auth.organizationId, enabled })
    }
}
