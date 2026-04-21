import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { User } from "terse-types/types"
import { SdkCreateProjectResponseBody, sdkCreateProjectRequestBodySchema } from "terse-types/types"

import { db } from "../prismaClient"

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
