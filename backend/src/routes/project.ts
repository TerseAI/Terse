import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { ProjectDetailResponse, User } from "terse-types/types"
import { SdkCreateProjectResponseBody, sdkCreateProjectRequestBodySchema } from "terse-types/types"

import { db } from "../prismaClient"

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
