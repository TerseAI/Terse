import { Prisma } from "@prisma/client"
import { ProjectDeploy, ProjectDeployUser, ProjectDeploysResponse, ProjectDetailResponse, ProjectsListResponse, ProjectSourceFilesResponse } from "terse-types/types"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"

import logger from "../../common/logger"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../realtimeSocket"
import { SecretService } from "../../services/SecretService"
import { tearDownAgentTriggers } from "../../routes/agents"
import { createProjectScopedToken } from "../../utility/apiTokens"
import { getActiveSourceCodeGcsKeyForProject } from "../../utility/projectHelper"
import { extractSdkZipFile, listSdkZipPathsRecursive, loadSdkSourceZip } from "../../utility/sdkZipReader"
import { generateWebhookSecret } from "../../utility/webhookSecrets"
import { workos } from "../../utility/workos"
import { db } from "../../loaders/prisma"
import {
    DeployRow,
    createProjectRow,
    deleteProject,
    findActiveDeployWithSourceImage,
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

    emitCacheInvalidationWithKey(organizationId, "agents")
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "organization-projects")
    logger.info("Project deleted", { projectId, organizationId, userId, automationCount: automationIds.length })
}

export async function getProjectDeploysForOrganization(projectId: string, organizationId: string): Promise<ProjectDeploysResponse> {
    const project = await findProjectBasic(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()

    const { deploys: deployRows, activeDeployId } = await findProjectDeploys(projectId, MAX_DEPLOYS_RETURNED)

    const workosIds = Array.from(new Set(deployRows.map(d => d.deployed_by?.workos_id).filter((w): w is string => !!w)))
    const workosUsers = await Promise.all(
        workosIds.map(async workosId => {
            try {
                const u = await workos.userManagement.getUser(workosId)
                return [workosId, u] as const
            } catch (error) {
                logger.warn("Failed to fetch WorkOS user for deploy", { error, workosId })
                return [workosId, null] as const
            }
        })
    )
    const workosUserById = new Map(workosUsers)

    const deploys: ProjectDeploy[] = deployRows.map((d: DeployRow) => {
        const dbUser = d.deployed_by
        const workosUser = dbUser?.workos_id ? workosUserById.get(dbUser.workos_id) : null
        const deployedBy: ProjectDeployUser | null = dbUser
            ? {
                  id: dbUser.id,
                  displayName: workosUser ? `${workosUser.firstName ?? ""} ${workosUser.lastName ?? ""}`.trim() || workosUser.email : "Unknown",
                  email: workosUser?.email ?? null,
                  avatarUrl: workosUser?.profilePictureUrl ?? null
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

export async function getProjectSourceFiles(projectId: string, organizationId: string): Promise<ProjectSourceFilesResponse> {
    const project = await findProjectBasic(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()

    const activeDeploy = await findActiveDeployWithSourceImage(projectId)
    if (!activeDeploy?.sdk_source_image?.gcs_key) {
        return { projectId, deployId: null, deployedAt: null, files: [] }
    }

    const zip = await loadSdkSourceZip(activeDeploy.sdk_source_image.gcs_key)
    const files = zip ? listSdkZipPathsRecursive(zip) : []
    return {
        projectId,
        deployId: activeDeploy.id,
        deployedAt: activeDeploy.created_at.toISOString(),
        files
    }
}

export async function getProjectSourceFileContent(projectId: string, fileId: string, organizationId: string) {
    const project = await findProjectBasic(projectId, organizationId)
    if (!project) throw new ProjectNotFoundError()

    const gcsKey = await getActiveSourceCodeGcsKeyForProject(projectId)
    const zip = await loadSdkSourceZip(gcsKey)
    if (!zip) throw new ProjectBadRequestError("No source archive for this project")

    const payload = extractSdkZipFile(zip, fileId)
    if (!payload) throw new ProjectNotFoundError()
    return payload
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
        return createProjectScopedToken(
            { projectId, projectName: project.name, organizationId, createdByUserId: userId },
            tx
        )
    })

    emitCacheInvalidationWithWildcard(organizationId, "project", projectId)
    logger.info("Project API key rotated", { projectId, organizationId, userId })
    return { projectApiKey: rawToken }
}

export async function createProject(name: string, organizationId: string): Promise<{ projectId: string; name: string }> {
    try {
        const project = await createProjectRow(organizationId, name)
        emitCacheInvalidationWithKey(organizationId, "organization-projects")
        return { projectId: project.id, name: project.name }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ProjectConflictError(`A project named "${name}" already exists in this organization.`)
        }
        throw error
    }
}
