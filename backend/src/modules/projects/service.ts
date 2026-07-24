import { Prisma } from "@prisma/client"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { ProjectDeploy, ProjectDeployUser, ProjectDeploysResponse, ProjectDetailResponse, ProjectsListResponse } from "terse-types/types"

import logger from "../../common/logger"
import { generateWebhookSecret } from "../../common/webhookSecrets"
import { db } from "../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../loaders/socket"
import { tearDownAgentTriggers } from "../../modules/agents/controller"
import { createProjectScopedToken } from "../../modules/auth/helpers/apiTokens"
import { SecretService } from "../../services/SecretService"
import { getAuthProvider } from "../../services/authProvider"
import { purgeProjectMemory } from "../../services/memory/memoryPurge"

import {
    DeployRow,
    createProjectRow,
    deleteProject,
    findFirstActiveRunForAutomations,
    findProjectBasic,
    findProjectDeploys,
    findProjectForRotation,
    findProjectWithAutomations,
    findProjectWithDetail,
    findProjectsForOrganization,
    updateProjectSigningSecret
} from "./repository"

const MAX_DEPLOYS_RETURNED = 25
const ACTIVE_RUN_STATUSES: RunHistoryStatus[] = [RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL]

export class ProjectNotFoundError extends Error {
    constructor() {
        super("Project not found")
        this.name = "ProjectNotFoundError"
    }
}

export class ProjectConflictError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ProjectConflictError"
    }
}

export class ProjectBadRequestError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ProjectBadRequestError"
    }
}

export async function listProjects(organizationId: string): Promise<ProjectsListResponse> {
    const projects = await findProjectsForOrganization(organizationId)
    return { projects }
}

export async function getProjectDetail(projectId: string, organizationId: string): Promise<ProjectDetailResponse> {
    const project = await findProjectWithDetail(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()
    return {
        id: project.id,
        name: project.name,
        createdAt: project.created_at.toISOString(),
        remoteServerUrl: project.remote_server_url,
        isSelfHosted: !!project.remote_server_url,
        hasSigningSecret: !!project.signing_secret,
        hasProjectApiKey: project.api_tokens.length > 0,
        jobs: project.automations.map(a => ({ id: a.id, name: a.name, isActive: a.is_active }))
    }
}

export async function deleteProjectForOrganization(projectId: string, organizationId: string, userId: string): Promise<void> {
    const project = await findProjectWithAutomations(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()

    const automationIds = project.automations.map(a => a.id)
    if (automationIds.length > 0) {
        const activeRun = await findFirstActiveRunForAutomations(automationIds, ACTIVE_RUN_STATUSES)
        if (activeRun) throw new ProjectConflictError("Project has in-flight runs. Wait for them to finish before deleting.")
    }

    for (const automation of project.automations) {
        await tearDownAgentTriggers(automation)
    }

    const secretService = SecretService.getInstance()
    await deleteProject(projectId)
    try {
        await secretService.deleteSecrets({ type: "project", secret: { projectId } })
    } catch (error) {
        logger.error("Project secret cleanup scheduling failed after project delete", { error, projectId })
    }

    // Purge all persistent memory for this project (best-effort).
    await purgeProjectMemory(projectId)

    emitCacheInvalidationWithKey(organizationId, "agents")
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "organization-projects")
    logger.info("Project deleted", { projectId, organizationId, userId, automationCount: automationIds.length })
}

export async function getProjectDeploysForOrganization(projectId: string, organizationId: string): Promise<ProjectDeploysResponse> {
    const project = await findProjectBasic(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()

    const { deploys: deployRows, activeDeployId } = await findProjectDeploys(projectId, MAX_DEPLOYS_RETURNED)

    const userIds = Array.from(new Set(deployRows.map(d => d.deployed_by_user_id).filter((w): w is string => !!w)))
    const users = await Promise.all(
        userIds.map(async userId => {
            const u = await getAuthProvider().getUser(userId)
            return [userId, u] as const
        })
    )
    const userById = new Map(users)

    const deploys: ProjectDeploy[] = deployRows.map((d: DeployRow) => {
        const deployerId = d.deployed_by_user_id
        const user = deployerId ? userById.get(deployerId) : null
        const deployedBy: ProjectDeployUser | null = deployerId
            ? {
                  id: deployerId,
                  displayName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : "Unknown",
                  email: user?.email ?? null,
                  avatarUrl: user?.displayPhotoUrl ?? null
              }
            : null
        const durationMs = d.completed_at ? d.completed_at.getTime() - d.created_at.getTime() : null
        const jobsDelta = d.jobs_added !== null && d.jobs_removed !== null ? { added: d.jobs_added, removed: d.jobs_removed } : null
        return {
            id: d.id,
            status: d.status,
            createdAt: d.created_at.toISOString(),
            isActive: activeDeployId === d.id,
            deployedBy,
            durationMs,
            failureReason: d.failure_reason,
            jobsDelta
        }
    })

    return { projectId, deploys }
}

export async function rotateSigningSecret(projectId: string, organizationId: string, userId: string): Promise<{ signingSecret: string }> {
    const project = await findProjectForRotation(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()
    if (!project.remote_server_url) throw new ProjectBadRequestError("Signing secrets are only used by self-hosted projects.")

    const signingSecret = generateWebhookSecret()
    await updateProjectSigningSecret(projectId, signingSecret)
    emitCacheInvalidationWithWildcard(organizationId, "project", projectId)
    logger.info("Project signing secret rotated", { projectId, organizationId, userId })
    return { signingSecret }
}

export async function rotateProjectApiKey(projectId: string, organizationId: string, userId: string): Promise<{ projectApiKey: string }> {
    const project = await findProjectForRotation(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()
    if (!project.remote_server_url) throw new ProjectBadRequestError("Project API keys are only used by self-hosted projects.")

    const { rawToken } = await db().$transaction(async tx => {
        await tx.api_tokens.deleteMany({ where: { project_id: projectId, organization_id: organizationId } })
        return createProjectScopedToken({ projectId, projectName: project.name, organizationId, createdByUserId: userId }, tx)
    })

    emitCacheInvalidationWithWildcard(organizationId, "project", projectId)
    logger.info("Project API key rotated", { projectId, organizationId, userId })
    return { projectApiKey: rawToken }
}

export async function createProject(
    name: string,
    organizationId: string,
    selfHosted?: boolean
): Promise<{ projectId: string; name: string; signingSecret?: string }> {
    try {
        const signingSecret = selfHosted ? generateWebhookSecret() : undefined
        const project = await createProjectRow(organizationId, name, signingSecret)
        emitCacheInvalidationWithKey(organizationId, "organization-projects")
        return { projectId: project.id, name: project.name, signingSecret }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ProjectConflictError(`A project named "${name}" already exists in this organization.`)
        }
        throw error
    }
}
