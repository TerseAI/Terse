import { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { IntegrationType } from "terse-types/Integrations"
import { GetGithubRepositoriesForIntegrationResponse, User as RuntimeUser } from "terse-types/types"
import { ZodError } from "zod"

import logger from "../../../common/logger"
import { GithubIntegrationManager, getAppInstallationRepositories, getAppInstallationsForUser } from "../../../integrations/github/integration"
import { getUserForOrg } from "../../../integrations/workos/helpers"
import { db } from "../../../loaders/prisma"
import { readBearerToken } from "../../../modules/auth/helpers/authDispatch"
import { SecretService } from "../../../services/SecretService"
import { githubApp, jwt as jwtConfig } from "../../../settings"

import { parseGithubUnifiedEventPayload } from "./eventParser"
import { GithubAppInstallationRepository } from "./types"

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
 * Handle unified GitHub event webhook.
 *
 * Authentication: the upstream terse-probot-app signs each call with
 * `jwt.sign({username}, JWT_SECRET)` and sends it as `Authorization: Bearer <token>`.
 * We verify that signature here before processing any payload. Without this
 * check the endpoint is unauthenticated event-spoofing — any attacker who
 * reaches it can forge GitHub events into arbitrary tenants and trigger
 * their automations with attacker-controlled prompts.
 */
export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const bearer = readBearerToken(req.headers.authorization)
    if (!bearer) {
        logger.warn("[github/unified-event] Missing bearer token")
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    try {
        jwt.verify(bearer, jwtConfig.secret)
    } catch (error) {
        logger.warn("[github/unified-event] Bearer token failed verification", { error: error instanceof Error ? error.message : error })
        res.status(401).json({ error: "Unauthorized" })
        return
    }

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
        logger.error("Unhandled error in getGithubRepositoriesForIntegration", { error, installationId })
        res.status(500).json({ message: "Failed to fetch repositories" })
    }
}
