import { Request, Response } from "express"
import { ProjectSecretsImportResponse, ProjectSecretsListResponse, User, projectSecretUpsertRequestSchema, projectSecretsImportRequestSchema } from "terse-types/types"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { createSecret, deleteManySecrets } from "../services/SecretService"
import { workos } from "../utility/workos"

const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
const MAX_SECRET_VALUE_BYTES = 64 * 1024

type ProjectAccess = {
    id: string
    organization_id: string
    remote_server_url: string | null
}

export async function handleListProjectSecrets(req: Request, res: Response) {
    const access = await requireManagedProject(req, res)
    if (!access) return

    const rows = await db().project_secrets.findMany({
        where: { project_id: access.id },
        orderBy: { name: "asc" },
        include: { created_by: true }
    })

    const workosIds = Array.from(new Set(rows.map(row => row.created_by?.workos_id).filter((id): id is string => !!id)))
    const workosUserById = new Map<string, Awaited<ReturnType<typeof workos.userManagement.getUser>> | null>()
    await Promise.all(
        workosIds.map(async workosId => {
            try {
                workosUserById.set(workosId, await workos.userManagement.getUser(workosId))
            } catch (error) {
                logger.warn("Failed to fetch WorkOS user for project secret", { error, workosId, projectId: access.id })
                workosUserById.set(workosId, null)
            }
        })
    )

    const response: ProjectSecretsListResponse = {
        secrets: rows.map(row => {
            const workosId = row.created_by?.workos_id
            const workosUser = workosId ? workosUserById.get(workosId) : null
            const createdBy = row.created_by
                ? {
                      displayName: workosUser ? `${workosUser.firstName ?? ""} ${workosUser.lastName ?? ""}`.trim() || workosUser.email : "Unknown",
                      avatarUrl: workosUser?.profilePictureUrl ?? null
                  }
                : undefined

            return {
                name: row.name,
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
                ...(createdBy ? { createdBy } : {})
            }
        })
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

    await storeSecretThenUpsertMetadata(access.id, user.id, body.name, body.value)
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

    await db().project_secrets.deleteMany({
        where: { project_id: access.id, name }
    })
    try {
        await deleteManySecrets([{ type: "project", params: { projectId: access.id, name } }])
    } catch (error) {
        logger.error("Project secret cleanup scheduling failed", { error, projectId: access.id, name })
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

    const existingRows = await db().project_secrets.findMany({
        where: { project_id: access.id, name: { in: [...validEntries.keys()] } },
        select: { name: true }
    })
    const existingNames = new Set(existingRows.map(row => row.name))
    const added: string[] = []
    const updated: string[] = []

    for (const [name, value] of validEntries) {
        try {
            await storeSecretThenUpsertMetadata(access.id, user.id, name, value)
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

async function storeSecretThenUpsertMetadata(projectId: string, userId: string, name: string, value: string): Promise<void> {
    await createSecret({ type: "project", params: { projectId, name } }, value)

    try {
        await db().project_secrets.upsert({
            where: { project_id_name: { project_id: projectId, name } },
            update: { updated_at: new Date() },
            create: {
                project_id: projectId,
                name,
                created_by_id: userId
            }
        })
    } catch (error) {
        let ownerKnownAbsent = false
        try {
            const owner = await db().project_secrets.findUnique({
                where: { project_id_name: { project_id: projectId, name } },
                select: { id: true }
            })
            ownerKnownAbsent = !owner
        } catch (lookupError) {
            logger.error("Could not verify project secret ownership during rollback; leaving GSM in place", { lookupError, projectId, name })
        }

        if (ownerKnownAbsent) {
            try {
                await deleteManySecrets([{ type: "project", params: { projectId, name } }])
            } catch (error) {
                logger.error("Failed to rollback project secret after DB write failure", { error, projectId, name })
            }
        } else {
            logger.error("Project secret DB metadata update failed after GSM write succeeded; metadata may be stale until retry", { error, projectId, name })
        }
        throw error
    }
}

function validateSecretEntry(name: string, value: string): string | null {
    const nameError = validateSecretName(name)
    if (nameError) return nameError

    if (Buffer.byteLength(value, "utf8") > MAX_SECRET_VALUE_BYTES) {
        return "Secret value must be 64KB or less"
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
