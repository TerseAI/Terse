import { Request, Response } from "express"
import {
    ProjectSecretSummary,
    ProjectSecretsImportResponse,
    ProjectSecretsListResponse,
    User,
    projectSecretUpsertRequestSchema,
    projectSecretsImportRequestSchema,
    validateSecretName,
    validateSecretValue
} from "terse-types/types"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { createSecrets, deleteSecretFields, listSecretKeys } from "../services/SecretService"

type ProjectAccess = {
    id: string
    organization_id: string
    remote_server_url: string | null
}

export async function handleListProjectSecrets(req: Request, res: Response) {
    const access = await requireManagedProject(req, res)
    if (!access) return

    const names = await listSecretKeys({ type: "project", secret: { projectId: access.id } })
    const response: ProjectSecretsListResponse = {
        secrets: names.map(name => ({ name }))
    }
    return res.status(200).json(response)
}

export async function handleUpsertProjectSecret(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    const access = await requireManagedProject(req, res)
    if (!access || !user) return

    const body = projectSecretUpsertRequestSchema.parse(req.body)
    const error = validateSecretEntry(body.name, body.value)
    if (error) {
        return res.status(400).json({ error })
    }

    await createSecrets({ type: "project", secret: { projectId: access.id, value: { [body.name]: body.value } } })
    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secret upserted", { projectId: access.id, userId: user.id, secretName: body.name })

    const response: ProjectSecretSummary = { name: body.name }
    return res.status(200).json(response)
}

export async function handleDeleteProjectSecret(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    const access = await requireManagedProject(req, res)
    if (!access) return

    const { name } = req.params
    if (!name) {
        return res.status(400).json({ error: "Secret name is required" })
    }

    const nameError = validateSecretName(name)
    if (nameError) {
        return res.status(400).json({ error: nameError })
    }

    const removed = await deleteSecretFields({ type: "project", secret: { projectId: access.id, keys: [name] } })
    if (!removed) {
        return res.status(404).json({ error: `Secret ${name} not found` })
    }

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secret deleted", { projectId: access.id, userId: user?.id, secretName: name })

    const response: ProjectSecretSummary = { name }
    return res.status(200).json(response)
}

export async function handleImportProjectSecrets(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    const access = await requireManagedProject(req, res)
    if (!access || !user) return

    const body = projectSecretsImportRequestSchema.parse(req.body)
    const validEntries: Record<string, string> = {}

    for (const entry of body.entries) {
        const error = validateSecretEntry(entry.name, entry.value)
        if (error) {
            return res.status(400).json({ error: `${entry.name}: ${error}` })
        }
        validEntries[entry.name] = entry.value
    }

    const acceptedNames = Object.keys(validEntries)
    if (acceptedNames.length === 0) {
        const response: ProjectSecretsImportResponse = { added: [], updated: [] }
        return res.status(200).json(response)
    }

    const existingNames = new Set(await listSecretKeys({ type: "project", secret: { projectId: access.id } }))
    await createSecrets({ type: "project", secret: { projectId: access.id, value: validEntries } })

    const added: string[] = []
    const updated: string[] = []
    for (const name of acceptedNames) {
        if (existingNames.has(name)) updated.push(name)
        else added.push(name)
    }

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secrets imported", { projectId: access.id, userId: user.id, addedCount: added.length, updatedCount: updated.length })

    const response: ProjectSecretsImportResponse = { added, updated }
    return res.status(200).json(response)
}

async function requireManagedProject(req: Request, res: Response): Promise<ProjectAccess | null> {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }

    const { id } = req.params
    if (!id) {
        res.status(400).json({ error: "Project id is required" })
        return null
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { id: true, organization_id: true, remote_server_url: true }
    })

    if (!project) {
        res.status(404).json({ error: "Project not found" })
        return null
    }

    if (project.remote_server_url) {
        res.status(400).json({ error: "Project secrets are only supported for managed projects." })
        return null
    }

    return project
}

function validateSecretEntry(name: string, value: string): string | null {
    return validateSecretName(name) ?? validateSecretValue(value)
}
