import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { GetGithubRepositoriesForIntegrationResponse, User as RuntimeUser } from "terse-types/types"
import { ZodError } from "zod"

import { GithubIntegrationManager, getAppInstallationRepositories, getAppInstallationsForUser } from "../integrations/GithubIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { GithubAppInstallationRepository } from "../routes/GithubTypes"
import { SecretService } from "../services/SecretService"
import { getUserForOrg } from "../utility/workos"

import { parseGithubUnifiedEventPayload } from "./githubUnifiedEventParser"

// MARK: - Route Handlers

export async function getGithubIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new GithubIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching GitHub integrations", { error })
        res.status(500).json({ error: "Failed to fetch GitHub integrations" })
    }
}

/**
 * Handle unified GitHub event webhook
 */
export async function githubAppUnifiedEvent(req: Request, res: Response) {
    let body: ReturnType<typeof parseGithubUnifiedEventPayload>
    try {
        body = parseGithubUnifiedEventPayload(req.body)
    } catch (error) {
        if (error instanceof ZodError) {
            logger.warn("Invalid GitHub unified event payload", {
                issues: error.issues
            })
            res.status(400).json({ error: "Invalid GitHub unified event payload", issues: error.issues })
            return
        }
        throw error
    }

    const { username, repositoryName } = body
    logger.info("githubAppUnifiedEvent", {
        eventType: body.eventType,
        repositoryName: body.repositoryName,
        username: body.username
    })

    try {
        // Process event through integration manager
        const githubIntegrationManager = new GithubIntegrationManager()
        await githubIntegrationManager.processWebhookEvent(body)
        res.status(200).json({ message: "Event processed successfully" })
    } catch (error) {
        logger.error("Error processing GitHub event in integration manager", {
            error,
            eventType: body.eventType,
            repositoryName,
            username
        })
        res.status(500).json({ error: "Failed to process GitHub event" })
    }
}

type RouteError = Error & { statusCode?: number }

function createRouteError(message: string, statusCode: number): RouteError {
    const error = new Error(message) as RouteError
    error.statusCode = statusCode
    return error
}

export async function fetchGithubRepositoriesForIntegration(organizationId: string, installationId: string): Promise<GetGithubRepositoriesForIntegrationResponse> {
    if (!installationId) {
        throw createRouteError("Installation ID is required", 400)
    }
    if (!organizationId) {
        throw createRouteError("Organization context is required", 400)
    }

    // Find a token in the org that has access to this installation
    const orgTokens = await db().github_app_tokens.findMany({
        where: { organization_id: organizationId }
    })
    if (orgTokens.length === 0) {
        throw createRouteError("Unauthorized", 401)
    }

    let targetInstallation: { id: number } | undefined
    let tokenWithAccess: string | null = null
    const secretService = SecretService.getInstance()

    for (const token of orgTokens) {
        const secrets = await secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: token.id } })
        if (!secrets) {
            logger.warn(`Github app token ${token.id} is missing its secret blob; skipping`, { tokenId: token.id })
            continue
        }
        const accessToken = secrets.accessToken

        const installations = await getAppInstallationsForUser(accessToken, {
            userId: token.user_id,
            tokenId: token.id,
            installationId: Number(installationId)
        })
        const installation = installations.installations.find(i => i.id === Number(installationId))
        if (installation) {
            targetInstallation = installation
            tokenWithAccess = accessToken
            break
        }
    }

    if (!targetInstallation || !tokenWithAccess) {
        throw createRouteError("Installation not found", 404)
    }

    const installationRepositories: GithubAppInstallationRepository[] = await getAppInstallationRepositories(tokenWithAccess, targetInstallation.id)

    return {
        repositories: installationRepositories.map(r => ({
            id: r.id,
            name: r.name,
            owner: r.owner.login
        }))
    }
}

export async function getGithubRepositoriesForIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ message: "Unauthorized" })
        return
    }

    const installationId = req.query.installation_id as string

    try {
        if (!req.session.user.organizationId) {
            return res.status(400).json({ message: "Organization context is required" })
        }
        const result = await fetchGithubRepositoriesForIntegration(req.session.user.organizationId, installationId)
        res.status(200).json(result)
    } catch (error) {
        // Only echo the message when the error came from createRouteError (i.e.
        // statusCode is set) — those messages are vetted controlled strings.
        // Anything else (Octokit/Axios/SecretService/Prisma) gets a generic 500
        // so internal API URLs, secret IDs, and gRPC error text don't leak.
        const routeError = error as RouteError
        if (routeError.statusCode) {
            res.status(routeError.statusCode).json({ message: routeError.message })
            return
        }
        logger.error("Unhandled error in getGithubRepositoriesForIntegration", { error, installationId })
        res.status(500).json({ message: "Failed to fetch repositories" })
    }
}
