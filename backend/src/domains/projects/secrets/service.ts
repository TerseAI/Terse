import { ProjectSecretsImportResponse, ProjectSecretsListResponse, validateSecretName, validateSecretValue } from "terse-types/types"

import logger from "../../../common/logger"
import { emitCacheInvalidationWithWildcard } from "../../../realtimeSocket"
import { SecretService } from "../../../services/SecretService"

import { ProjectAccess, findProjectForSecretAccess } from "./repository"

export class ProjectSecretNotFoundError extends Error {
    constructor(message = "Project not found") {
        super(message)
        this.name = "ProjectSecretNotFoundError"
    }
}

export class ProjectSecretBadRequestError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ProjectSecretBadRequestError"
    }
}

export async function requireManagedProjectAccess(projectId: string, organizationId: string): Promise<ProjectAccess> {
    const project = await findProjectForSecretAccess(projectId, organizationId)
    if (!project) throw new ProjectSecretNotFoundError()
    if (project.remote_server_url) {
        throw new ProjectSecretBadRequestError("Project secrets are only supported for managed projects.")
    }
    return project
}

function validateSecretEntry(name: string, value: string): string | null {
    return validateSecretName(name) ?? validateSecretValue(value)
}

export async function listSecretsForProject(projectId: string, organizationId: string): Promise<ProjectSecretsListResponse> {
    const access = await requireManagedProjectAccess(projectId, organizationId)
    const secretService = SecretService.getInstance()
    const names = await secretService.listSecretKeys({ type: "project", secret: { projectId: access.id } })
    return { secrets: names.map(name => ({ name })) }
}

export async function upsertSecretForProject(projectId: string, organizationId: string, userId: string, body: { name: string; value: string }): Promise<{ name: string }> {
    const access = await requireManagedProjectAccess(projectId, organizationId)
    const error = validateSecretEntry(body.name, body.value)
    if (error) throw new ProjectSecretBadRequestError(error)

    const secretService = SecretService.getInstance()
    await secretService.createSecrets({ type: "project", secret: { projectId: access.id, value: { [body.name]: body.value } } })
    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secret upserted", { projectId: access.id, userId, secretName: body.name })
    return { name: body.name }
}

export async function deleteSecretForProject(projectId: string, organizationId: string, userId: string | undefined, name: string): Promise<{ name: string }> {
    const access = await requireManagedProjectAccess(projectId, organizationId)
    const nameError = validateSecretName(name)
    if (nameError) throw new ProjectSecretBadRequestError(nameError)

    const secretService = SecretService.getInstance()
    const removed = await secretService.deleteSecretFields({ type: "project", secret: { projectId: access.id, keys: [name] } })
    if (!removed) throw new ProjectSecretNotFoundError(`Secret ${name} not found`)

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secret deleted", { projectId: access.id, userId, secretName: name })
    return { name }
}

export async function importSecretsForProject(
    projectId: string,
    organizationId: string,
    userId: string,
    body: { entries: Array<{ name: string; value: string }> }
): Promise<ProjectSecretsImportResponse> {
    const access = await requireManagedProjectAccess(projectId, organizationId)

    const validEntries: Record<string, string> = {}
    for (const entry of body.entries) {
        const error = validateSecretEntry(entry.name, entry.value)
        if (error) throw new ProjectSecretBadRequestError(`${entry.name}: ${error}`)
        validEntries[entry.name] = entry.value
    }

    const acceptedNames = Object.keys(validEntries)
    if (acceptedNames.length === 0) return { added: [], updated: [] }

    const secretService = SecretService.getInstance()
    const existingNames = new Set(await secretService.listSecretKeys({ type: "project", secret: { projectId: access.id } }))
    await secretService.createSecrets({ type: "project", secret: { projectId: access.id, value: validEntries } })

    const added: string[] = []
    const updated: string[] = []
    for (const name of acceptedNames) {
        if (existingNames.has(name)) updated.push(name)
        else added.push(name)
    }

    emitCacheInvalidationWithWildcard(access.organization_id, "projectSecrets", access.id)
    logger.info("Project secrets imported", { projectId: access.id, userId, addedCount: added.length, updatedCount: updated.length })
    return { added, updated }
}
