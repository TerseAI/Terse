import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { PosthogProjectEventsResponse, PosthogProjectsResponse, posthogProjectEventsQuerySchema } from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { parseFormSubmissionFromRequest } from "../../../integrations/abstract/Integration"
import { PosthogIntegrationManager } from "../../../integrations/posthog/integration"
import { db } from "../../../loaders/prisma"
import { SecretService } from "../../../services/SecretService"
import { runPosthogHogqlQuery } from "../../../utility/posthog"

export async function getPosthogIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    try {
        const manager = new PosthogIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Posthog integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Posthog integrations" })
    }
}

export async function createOrUpdatePosthogIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) return res.status(401).json({ error: "Unauthorized" })
    try {
        const manager = new PosthogIntegrationManager()
        const result = await manager.processFormSubmission(input)
        if (!result.success) {
            return res.status(result.statusCode || 500).json({ error: result.error || "Failed to process integration", ...(result.data || {}) })
        }
        res.status(result.statusCode || 200).json(result.data || { success: true })
    } catch (error) {
        logger.error("Error creating/updating Posthog integration:", { error })
        res.status(500).json({ error: "Failed to process integration" })
    }
}

export const getPosthogProjects = async (req: Request, res: Response) => {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    const integrationId = req.query.integrationId as string
    if (!integrationId) return res.status(400).json({ error: "integrationId is required" })

    const search = (req.query.search as string) || ""

    try {
        if (!user.organizationId) return res.status(400).json({ error: "Organization context is required" })
        const responseData = await fetchPosthogProjects(user.organizationId, integrationId, search)
        res.status(200).json(responseData)
    } catch (error: any) {
        logger.error("Error fetching Posthog projects:", { error })
        res.status(500).json({ error: "Failed to fetch projects", details: error.message })
    }
}

export const getPosthogProjectEvents = async (req: Request, res: Response) => {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.organizationId) return res.status(400).json({ error: "Organization context is required" })

    const parsed = posthogProjectEventsQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: "integrationId and projectId are required" })

    try {
        const responseData = await fetchPosthogProjectEvents(user.organizationId, parsed.data.integrationId, parsed.data.projectId)
        res.status(200).json(responseData)
    } catch (error: any) {
        logger.error("Error fetching Posthog project events:", { error })
        res.status(500).json({ error: "Failed to fetch events", details: error.message })
    }
}

/**
 * Custom event names observed in the project over the last 180 days, most frequent first.
 * Feeds the PosthogEventName union in terse.generated.ts.
 */
export const fetchPosthogProjectEvents = async (organizationId: string, integrationId: string, projectId: string): Promise<PosthogProjectEventsResponse> => {
    const apiKey = await getPosthogApiKeyForOrganization(organizationId, integrationId)
    const hogql = "SELECT event, count() AS count FROM events WHERE timestamp >= now() - INTERVAL 180 DAY AND event NOT LIKE '$%' GROUP BY event ORDER BY count DESC LIMIT 1000"
    const rows = await runPosthogHogqlQuery(projectId, apiKey, hogql, {})
    return { events: rows.map(row => ({ name: String(row[0] ?? ""), count: Number(row[1] ?? 0) })).filter(event => event.name) }
}

export const fetchPosthogProjects = async (organizationId: string, integrationId: string, search: string = ""): Promise<PosthogProjectsResponse> => {
    const apiKey = await getPosthogApiKeyForOrganization(organizationId, integrationId)

    const apiUrl = "https://us.posthog.com/api/projects/"
    const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error("Posthog API error fetching projects", { status: response.status, error: errorText })
        throw new Error(response.status === 401 ? "Invalid API key" : errorText)
    }

    const data = await response.json()
    let projects = Array.isArray(data) ? data : data.results || data.data || []

    if (search) {
        const searchLower = search.toLowerCase()
        projects = projects.filter((project: any) => project.name?.toLowerCase().includes(searchLower) || project.id?.toString().toLowerCase().includes(searchLower))
    }

    const mappedProjects = projects
        .map((project: any) => ({
            id: project.id?.toString() || project.uuid || "",
            name: project.name || "Unnamed Project",
            organization_id: project.organization_id || project.organization?.id || undefined
        }))
        .filter((project: any) => project.id)

    if (!search) {
        mappedProjects.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    }

    return { projects: mappedProjects }
}

async function getPosthogApiKeyForOrganization(organizationId: string, integrationId: string): Promise<string> {
    const integration = await db().posthog_integrations.findFirst({
        where: { id: integrationId, organization_id: organizationId }
    })
    if (!integration) throw new Error("Posthog integration not found")
    const secretService = SecretService.getInstance()
    const secret = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.POSTHOG, recordId: integration.id } })
    return secret.apiKey
}
