import { Request, Response } from "express"
import { ProjectSecretsImportResponse, ProjectSecretsListResponse, User, projectSecretUpsertRequestSchema, projectSecretsImportRequestSchema } from "terse-types/types"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { createSecrets, deleteSecretFields, listSecretKeys } from "../services/SecretService"

const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
const MAX_SECRET_VALUE_BYTES = 32 * 1024

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

    return res.status(204).send()
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

    try {
        await deleteSecretFields({ type: "project", secret: { projectId: access.id, keys: [name] } })
    } catch (error) {
        logger.error("Project secret deletion failed", { error, projectId: access.id, name })
    }

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secret deleted", { projectId: access.id, userId: user?.id, secretName: name })

    return res.status(204).send()
}

export async function handleImportProjectSecrets(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    const access = await requireManagedProject(req, res)
    if (!access || !user) return

    const body = projectSecretsImportRequestSchema.parse(req.body)
    const rejected: ProjectSecretsImportResponse["rejected"] = []
    const validEntries = new Map<string, string>()

    for (const entry of body.entries) {
        const error = validateSecretEntry(entry.name, entry.value)
        if (error) {
            rejected.push({ name: entry.name, reason: error })
            continue
        }
        validEntries.set(entry.name, entry.value)
    }

    const existingNames = new Set(await listSecretKeys({ type: "project", secret: { projectId: access.id } }))
    const added: string[] = []
    const updated: string[] = []

    for (const [name, value] of validEntries) {
        try {
            await createSecrets({ type: "project", secret: { projectId: access.id, value: { [name]: value } } })
            if (existingNames.has(name)) {
                updated.push(name)
            } else {
                added.push(name)
            }
        } catch (error) {
            logger.error("Project secret import entry failed", { error, projectId: access.id, name })
            rejected.push({ name, reason: "Failed to store secret" })
        }
    }

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secrets imported", { projectId: access.id, userId: user.id, addedCount: added.length, updatedCount: updated.length, rejectedCount: rejected.length })

    const response: ProjectSecretsImportResponse = {
        added,
        updated,
        rejected
    }
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
    const nameError = validateSecretName(name)
    if (nameError) return nameError

    if (Buffer.byteLength(value, "utf8") > MAX_SECRET_VALUE_BYTES) {
        return "Secret value must be 32KB or less"
    }

    return null
}

function validateSecretName(name: string): string | null {
    if (!SECRET_NAME_PATTERN.test(name)) {
        return "Secret names must match ^[A-Z][A-Z0-9_]{0,63}$"
    }

    if (name.startsWith("TERSE_")) {
        return "Secret names cannot start with TERSE_"
    }

    return null
}
