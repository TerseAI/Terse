import { Request, Response } from "express"
import { UserSession } from "terse-types/types"
import { SdkCreateProjectResponseBody, sdkCreateProjectRequestBodySchema } from "terse-types/types"

import { AnalyticsEvent, analytics } from "../../common/analytics"
import logger from "../../common/logger"

import {
    ProjectBadRequestError,
    ProjectConflictError,
    ProjectNotFoundError,
    createProject,
    deleteProjectForOrganization,
    ensureSelfHostedCredentials,
    getProjectDeploysForOrganization,
    getProjectDetail,
    listProjects,
    rotateProjectApiKey,
    rotateSigningSecret
} from "./service"

function requireUser(req: Request, res: Response): UserSession | null {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }
    return user
}

function handleServiceError(error: unknown, res: Response, logContext: Record<string, unknown>): Response | undefined {
    if (error instanceof ProjectNotFoundError) return res.status(404).json({ error: error.message })
    if (error instanceof ProjectBadRequestError) return res.status(400).json({ error: error.message })
    if (error instanceof ProjectConflictError) return res.status(409).json({ error: error.message })
    logger.error("Project controller error", { error, ...logContext })
    return res.status(500).json({ error: "Internal server error" })
}

export async function handleListProjects(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const response = await listProjects(user.organizationId)
    res.status(200).json(response)
}

export async function handleGetProjectById(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await getProjectDetail(id, user.organizationId)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleProjectDelete(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        await deleteProjectForOrganization(id, user.organizationId, user.id)
        analytics.capture(user.id, AnalyticsEvent.PROJECT_DELETED, { projectId: id, organizationId: user.organizationId })
        res.status(204).send()
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleGetProjectDeploys(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await getProjectDeploysForOrganization(id, user.organizationId)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleRotateProjectSigningSecret(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await rotateSigningSecret(id, user.organizationId, user.id)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleRotateProjectApiKey(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await rotateProjectApiKey(id, user.organizationId, user.id)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleEnsureProjectCredentials(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { id } = req.params
    if (!id) return res.status(400).json({ error: "Project id is required" })
    try {
        const response = await ensureSelfHostedCredentials(id, user.organizationId, user.id)
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { projectId: id, userId: user.id })
    }
}

export async function handleProjectCreate(req: Request, res: Response) {
    const user = requireUser(req, res)
    if (!user) return
    const { name, selfHosted } = sdkCreateProjectRequestBodySchema.parse(req.body)
    try {
        const { projectId, name: projectName, signingSecret, projectApiKey } = await createProject(name, user.organizationId, user.id, selfHosted)
        analytics.capture(user.id, AnalyticsEvent.PROJECT_CREATED, { projectId, projectName, organizationId: user.organizationId })
        const response: SdkCreateProjectResponseBody = { projectId, name: projectName, signingSecret, projectApiKey }
        res.status(200).json(response)
    } catch (error) {
        return handleServiceError(error, res, { name, userId: user.id })
    }
}
