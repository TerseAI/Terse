import { Prisma } from "@prisma/client"
import { RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"

import { db } from "../../loaders/prisma"
import { getInputConfigInclude } from "../../utility/prismaIncludes"

export async function findProjectsForOrganization(organizationId: string) {
    return db().projects.findMany({
        where: { organization_id: organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })
}

export async function findProjectWithDetail(projectId: string, organizationId: string) {
    return db().projects.findFirst({
        where: { id: projectId, organization_id: organizationId },
        select: {
            id: true,
            name: true,
            created_at: true,
            remote_server_url: true,
            signing_secret: true,
            api_tokens: { where: { project_id: projectId }, select: { id: true }, take: 1 },
            automations: {
                select: { id: true, name: true, is_active: true },
                orderBy: { created_at: "desc" }
            }
        }
    })
}

export async function findProjectWithAutomations(projectId: string, organizationId: string) {
    return db().projects.findFirst({
        where: { id: projectId, organization_id: organizationId },
        include: {
            automations: { include: { inputs: { include: getInputConfigInclude() } } }
        }
    })
}

export async function findProjectBasic(projectId: string, organizationId: string) {
    return db().projects.findFirst({
        where: { id: projectId, organization_id: organizationId },
        select: { id: true }
    })
}

export async function findProjectForRotation(projectId: string, organizationId: string) {
    return db().projects.findFirst({
        where: { id: projectId, organization_id: organizationId },
        select: { remote_server_url: true, name: true }
    })
}

export async function findFirstActiveRunForAutomations(automationIds: string[], statuses: string[]) {
    return db().run_history_records.findFirst({
        where: {
            automation_id: { in: automationIds },
            status: { in: statuses as PrismaRunHistoryStatus[] }
        },
        select: { id: true }
    })
}

export async function deleteProject(projectId: string): Promise<void> {
    await db().projects.delete({ where: { id: projectId } })
}

export async function updateProjectSigningSecret(projectId: string, signingSecret: string): Promise<void> {
    await db().projects.update({ where: { id: projectId }, data: { signing_secret: signingSecret } })
}

export async function createProjectRow(organizationId: string, name: string) {
    return db().projects.create({
        data: { name, organization_id: organizationId }
    })
}

export type DeployRow = Prisma.project_deploysGetPayload<{ include: { deployed_by: true } }>

export async function findProjectDeploys(projectId: string, max: number): Promise<{ deploys: DeployRow[]; activeDeployId: string | null }> {
    const prisma = db()
    const [deployRows, activeDeploy] = await Promise.all([
        prisma.project_deploys.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: "desc" },
            take: max,
            include: { deployed_by: true }
        }),
        prisma.project_deploys.findFirst({
            where: { project_id: projectId, status: "SUCCEEDED" },
            orderBy: { created_at: "desc" },
            select: { id: true }
        })
    ])
    return { deploys: deployRows, activeDeployId: activeDeploy?.id ?? null }
}

export async function findActiveDeployWithSourceImage(projectId: string) {
    return db().project_deploys.findFirst({
        where: { project_id: projectId, status: "SUCCEEDED" },
        orderBy: { created_at: "desc" },
        include: { sdk_source_image: true }
    })
}
