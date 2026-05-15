import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { GetGithubRepositoriesForIntegrationResponse, User as RuntimeUser } from "terse-types/types"
import { ZodError } from "zod"

import { githubApp } from "../config/settings"
import { GithubIntegrationManager, getAppInstallationRepositories, getAppInstallationsForUser } from "../integrations/GithubIntegration"
import logger from "../logger"
import { db } from "../prismaClient"
import { GithubAppInstallationRepository } from "../routes/GithubTypes"
import { getSecrets } from "../services/SecretService"
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

export async function getInstallationUrl(req: Request, res: Response) {
    try {
        const appName = githubApp.appName
        const clientId = githubApp.clientId
        const userId = req.session?.user?.id
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        const state = Buffer.from(userId).toString("base64")
        // Generate GitHub App installation URL with callback
        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&target_type=repositories&state=${state}`

        res.json({
            installationUrl
        })
    } catch (error) {
        logger.error("Error generating installation URL", { error })
        res.status(500).json({ message: "Failed to generate installation URL" })
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

    for (const token of orgTokens) {
        const secrets = await getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: token.id } })
        if (!secrets) {
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
        const routeError = error as RouteError
        res.status(routeError.statusCode || 500).json({ message: routeError.message || "Failed to fetch repositories" })
    }
}

// Given an installation and username, resolve a specific user (runtime User type)
export async function resolveUserForGithubInstallation(installationId: number, username: string): Promise<RuntimeUser | null> {
    const usersFromInstallation = await resolveUsersForGithubInstallation(installationId)
    const installationUserIds = usersFromInstallation.map(u => u.id)

    // Match by github_username in github_app_tokens (users table no longer has github_username)
    const tokenForUsername = await db().github_app_tokens.findFirst({
        where: {
            github_username: username,
            user_id: { in: installationUserIds }
        }
    })
    if (tokenForUsername?.organization_id) {
        const user = await getUserForOrg(tokenForUsername.user_id, tokenForUsername.organization_id)
        if (user) return user
    }

    // User might have token but not be in installation list yet (e.g. new install)
    const anyTokenForUsername = await db().github_app_tokens.findFirst({
        where: { github_username: username }
    })
    if (anyTokenForUsername?.organization_id && installationUserIds.includes(anyTokenForUsername.user_id)) {
        const user = await getUserForOrg(anyTokenForUsername.user_id, anyTokenForUsername.organization_id)
        if (user) return user
    }

    return null
}

// Given an installation, we need to fetch all users that are associated with that installation.
// This doesn't guarantee that they have an active input config, but it's a good start.
// This is super inefficient, but it's a good start. We need to optimize this.
async function resolveUsersForGithubInstallation(installationId: number): Promise<import("../types/prisma").User[]> {
    return db().$transaction(async tx => {
        // Get all of our github app users.
        const githubAppUsers = await tx.github_app_tokens.findMany()

        // for each github App user, get their installations they have access to. Return a Map<user_id, installations>
        const installationResults = await Promise.all(
            githubAppUsers.map(async user => {
                const secrets = await getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: user.id } })
                if (!secrets) {
                    return {
                        userId: user.user_id,
                        installations: []
                    }
                }
                const accessToken = secrets.accessToken

                const installations = await getAppInstallationsForUser(accessToken, {
                    userId: user.user_id,
                    tokenId: user.id,
                    installationId
                })
                return {
                    userId: user.user_id,
                    installations: installations.installations
                }
            })
        )

        // Find users who have access to the specific installation
        const userIds = installationResults.filter(result => result.installations.some(inst => inst.id === installationId)).map(result => result.userId)

        // Fetch and return the User objects
        const users = await tx.users.findMany({
            where: { id: { in: userIds } }
        })

        logger.debug(`Found ${users.length} users for event from installation`, {
            installationId,
            userCount: users.length
        })

        return users
    })
}
