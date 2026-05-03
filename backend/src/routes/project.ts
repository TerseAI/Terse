import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import {
    ProjectDeploy,
    ProjectDeployUser,
    ProjectDeploysResponse,
    ProjectDetailResponse,
    ProjectRotateApiKeyResponse,
    ProjectRotateSigningSecretResponse,
    ProjectSourceFilesResponse,
    User
} from "terse-types/types"
import { SdkCreateProjectResponseBody, sdkCreateProjectRequestBodySchema } from "terse-types/types"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { createProjectScopedToken } from "../utility/apiTokens"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { getActiveSourceCodeGcsKeyForProject } from "../utility/projectHelper"
import { extractSdkZipFile, listSdkZipPathsRecursive, loadSdkSourceZip } from "../utility/sdkZipReader"
import { generateWebhookSecret } from "../utility/webhookSecrets"
import { workos } from "../utility/workos"

import { tearDownAgentTriggers } from "./agents"

const MAX_DEPLOYS_RETURNED = 25

const ACTIVE_RUN_STATUSES: RunHistoryStatus[] = [RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL]

export async function handleGetProjectById(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { id } = req.params
    if (!id) {
        return res.status(400).json({ error: "Project id is required" })
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: {
            id: true,
            name: true,
            created_at: true,
            remote_server_url: true,
            signing_secret: true,
            api_tokens: { where: { project_id: id }, select: { id: true }, take: 1 },
            automations: {
                select: { id: true, name: true, is_active: true },
                orderBy: { created_at: "desc" }
            }
        }
    })

    if (!project) {
        return res.status(404).json({ error: "Project not found" })
    }

    const response: ProjectDetailResponse = {
        id: project.id,
        name: project.name,
        createdAt: project.created_at.toISOString(),
        remoteServerUrl: project.remote_server_url,
        isSelfHosted: !!project.remote_server_url,
        hasSigningSecret: !!project.signing_secret,
        hasProjectApiKey: project.api_tokens.length > 0,
        jobs: project.automations.map(a => ({
            id: a.id,
            name: a.name,
            isActive: a.is_active
        }))
    }

    return res.status(200).json(response)
}

export async function handleProjectDelete(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { id } = req.params
    if (!id) {
        return res.status(400).json({ error: "Project id is required" })
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        include: {
            automations: { include: { inputs: { include: getInputConfigInclude() } } }
        }
    })

    if (!project) {
        return res.status(404).json({ error: "Project not found" })
    }

    const automationIds = project.automations.map(a => a.id)

    if (automationIds.length > 0) {
        const activeRun = await db().run_history_records.findFirst({
            where: {
                automation_id: { in: automationIds },
                status: { in: ACTIVE_RUN_STATUSES }
            },
            select: { id: true }
        })

        if (activeRun) {
            return res.status(409).json({
                error: "Project has in-flight runs. Wait for them to finish before deleting."
            })
        }
    }

    for (const automation of project.automations) {
        await tearDownAgentTriggers(automation)
    }

    await db().projects.delete({ where: { id } })

    emitCacheInvalidationWithKey(user.organizationId, "agents")
    emitCacheInvalidationWithKey(user.organizationId, "recentAgents")

    logger.info("Project deleted", { projectId: id, organizationId: user.organizationId, automationCount: automationIds.length })

    return res.status(204).send()
}

export async function handleGetProjectDeploys(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { id } = req.params
    if (!id) {
        return res.status(400).json({ error: "Project id is required" })
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { id: true }
    })
    if (!project) {
        return res.status(404).json({ error: "Project not found" })
    }

    const [deployRows, activeDeploy] = await Promise.all([
        db().project_deploys.findMany({
            where: { project_id: id },
            orderBy: { created_at: "desc" },
            take: MAX_DEPLOYS_RETURNED,
            include: { deployed_by: true }
        }),
        db().project_deploys.findFirst({
            where: { project_id: id, status: "SUCCEEDED" },
            orderBy: { created_at: "desc" },
            select: { id: true }
        })
    ])

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

    const deploys: ProjectDeploy[] = deployRows.map(d => {
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
            isActive: activeDeploy?.id === d.id,
            deployedBy,
            durationMs,
            failureReason: d.failure_reason,
            jobsDelta
        }
    })

    const response: ProjectDeploysResponse = {
        projectId: id,
        deploys
    }

    return res.status(200).json(response)
}

export async function handleGetProjectSourceFiles(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { id } = req.params
    if (!id) {
        return res.status(400).json({ error: "Project id is required" })
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { id: true }
    })
    if (!project) {
        return res.status(404).json({ error: "Project not found" })
    }

    try {
        const activeDeploy = await db().project_deploys.findFirst({
            where: { project_id: id, status: "SUCCEEDED" },
            orderBy: { created_at: "desc" },
            include: { sdk_source_image: true }
        })

        if (!activeDeploy?.sdk_source_image?.gcs_key) {
            const response: ProjectSourceFilesResponse = {
                projectId: id,
                deployId: null,
                deployedAt: null,
                files: []
            }
            return res.status(200).json(response)
        }

        const zip = await loadSdkSourceZip(activeDeploy.sdk_source_image.gcs_key)
        const files = zip ? listSdkZipPathsRecursive(zip) : []

        const response: ProjectSourceFilesResponse = {
            projectId: id,
            deployId: activeDeploy.id,
            deployedAt: activeDeploy.created_at.toISOString(),
            files
        }
        return res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching project source files", { error, projectId: id })
        return res.status(500).json({ error: "Failed to fetch project source files" })
    }
}

export async function handleGetProjectSourceFileContent(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { id, fileId } = req.params
    if (!id) {
        return res.status(400).json({ error: "Project id is required" })
    }
    if (!fileId || typeof fileId !== "string") {
        return res.status(400).json({ error: "Invalid file ID" })
    }

    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { id: true }
    })
    if (!project) {
        return res.status(404).json({ error: "Project not found" })
    }

    try {
        const gcsKey = await getActiveSourceCodeGcsKeyForProject(id)
        const zip = await loadSdkSourceZip(gcsKey)
        if (!zip) {
            return res.status(404).json({ error: "No source archive for this project" })
        }

        const payload = extractSdkZipFile(zip, fileId)
        if (!payload) {
            return res.status(404).json({ error: "File not found" })
        }

        return res.status(200).json(payload)
    } catch (error) {
        logger.error("Error fetching project source file", { error, projectId: id, fileId })
        return res.status(500).json({ error: "Failed to fetch project source file" })
    }
}

export async function handleRotateProjectSigningSecret(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const { id } = req.params
    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { remote_server_url: true }
    })
    if (!project) return res.status(404).json({ error: "Project not found" })
    if (!project.remote_server_url) return res.status(400).json({ error: "Signing secrets are only used by self-hosted projects." })

    const signingSecret = generateWebhookSecret()
    await db().projects.update({ where: { id }, data: { signing_secret: signingSecret } })

    emitCacheInvalidationWithWildcard(user.organizationId, "project", id)
    logger.info("Project signing secret rotated", { projectId: id, organizationId: user.organizationId, userId: user.id })

    const response: ProjectRotateSigningSecretResponse = { signingSecret }
    return res.status(200).json(response)
}

export async function handleRotateProjectApiKey(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const { id } = req.params
    const project = await db().projects.findFirst({
        where: { id, organization_id: user.organizationId },
        select: { name: true, remote_server_url: true }
    })
    if (!project) return res.status(404).json({ error: "Project not found" })
    if (!project.remote_server_url) return res.status(400).json({ error: "Project API keys are only used by self-hosted projects." })

    const { rawToken } = await db().$transaction(async tx => {
        await tx.api_tokens.deleteMany({ where: { project_id: id, organization_id: user.organizationId } })
        return createProjectScopedToken(
            {
                projectId: id,
                projectName: project.name,
                organizationId: user.organizationId,
                createdByUserId: user.id
            },
            tx
        )
    })

    emitCacheInvalidationWithWildcard(user.organizationId, "project", id)
    logger.info("Project API key rotated", { projectId: id, organizationId: user.organizationId, userId: user.id })

    const response: ProjectRotateApiKeyResponse = { projectApiKey: rawToken }
    return res.status(200).json(response)
}

export async function handleProjectCreate(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { name } = sdkCreateProjectRequestBodySchema.parse(req.body)

    try {
        const project = await db().projects.create({
            data: {
                name,
                organization_id: user.organizationId
            }
        })

        const response: SdkCreateProjectResponseBody = {
            projectId: project.id,
            name: project.name
        }

        res.status(200).json(response)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: `A project named "${name}" already exists in this organization.` })
        }
        throw error
    }
}
