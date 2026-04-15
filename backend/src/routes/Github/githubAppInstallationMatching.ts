import { Request, Response } from "express"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { emitCacheInvalidationWithKey } from "../../realtimeSocket"
import { GithubRepository } from "../../types/prisma"

type GithubAppInstallationDeletedRequest = {
    username: string
    installationId: number
}

export async function githubAppInstallationDeleted(req: Request, res: Response) {
    logger.info("githubAppInstallationDeleted", { body: req.body })
    const body: GithubAppInstallationDeletedRequest = req.body as GithubAppInstallationDeletedRequest

    // Look up organizationId before deletion (installation record will be removed in transaction)
    const installation = await db().user_github_installation.findUnique({
        where: { installation_id: body.installationId },
        select: { user_id: true }
    })
    let organizationId: string | null = null
    if (installation?.user_id) {
        const token = await db().github_app_tokens.findFirst({
            where: { user_id: installation.user_id },
            select: { organization_id: true }
        })
        organizationId = token?.organization_id ?? null
    }

    await db().$transaction(async tx => {
        // find all repos for this installation
        const repositories: GithubRepository[] = await tx.github_repositories.findMany({
            where: { installation_id: body.installationId }
        })

        if (repositories.length === 0) {
            res.status(404).json({ message: "No repositories found for this installation" })
            return
        }

        // remove all associations for those repos
        await tx.user_github_repositories.deleteMany({
            where: {
                github_repository_id: { in: repositories.map(repo => repo.id) }
            }
        })

        // now remove the installation + repositories
        await tx.github_repositories.deleteMany({
            where: { installation_id: body.installationId }
        })
        await tx.user_github_installation.deleteMany({
            where: { installation_id: body.installationId }
        })
    })

    // TODO: We need to invalidate Automations that were dependent on these repositories. This is a more general issue we don't account for yet.

    if (organizationId) {
        emitCacheInvalidationWithKey(organizationId, "integrations")
    }

    res.status(200).json({ message: "Repositories removed from user" })
}
