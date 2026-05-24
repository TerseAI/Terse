import { Request, Response } from "express"
import { UserSession, projectSecretUpsertRequestSchema, projectSecretsImportRequestSchema } from "terse-types/types"

import logger from "../../../common/logger"

import { ProjectSecretBadRequestError, ProjectSecretNotFoundError, deleteSecretForProject, importSecretsForProject, listSecretsForProject, upsertSecretForProject } from "./service"

function requireUser(req: Request, res: Response): UserSession | null {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }
    return user
}

function handleServiceError(error: unknown, res: Response, logContext: Record<string, unknown>): Response | undefined {
    if (error instanceof ProjectSecretNotFoundError) return res.status(404).json({ error: error.message })
    if (error instanceof ProjectSecretBadRequestError) return res.status(400).json({ error: error.message })
    logger.error("Project secrets controller error", { error, ...logContext })
    return res.status(500).json({ error: "Internal server error" })
}

export async function handleListProjectSecrets(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await listSecretsForProject(id, user.organizationId)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleUpsertProjectSecret(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    const body = projectSecretUpsertRequestSchema.parse(req.body)
    try {
        const response = await upsertSecretForProject(id, user.organizationId, user.id, body)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleDeleteProjectSecret(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id, name } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    if (!name) return res.status(400).json({ error: "Secret name is required" })
    try {
        const response = await deleteSecretForProject(id, user.organizationId, user.id, name)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id, secretName: name })
    }
}

export async function handleImportProjectSecrets(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    const body = projectSecretsImportRequestSchema.parse(req.body)
    try {
        const response = await importSecretsForProject(id, user.organizationId, user.id, body)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}
