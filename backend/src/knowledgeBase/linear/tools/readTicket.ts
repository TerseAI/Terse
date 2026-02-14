import { LinearClient } from "@linear/sdk"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { validate as isValidUuid } from "uuid"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const linearReadTicketTool = tool({
    name: ToolName.LINEAR_READ_TICKET,
    description: `Read detailed information about a Linear issue/ticket including title, description, state, assignee, and optionally all comments.
Use the issue ID (UUID) or the issue identifier (e.g. "TEAM-123"). Use this after searching for tickets to get full details.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear integration to use."),
        issueId: z.string().describe("The Linear issue ID (UUID) or identifier (e.g. 'PROJ-123')."),
        includeComments: z.boolean().nullable().optional().describe("Whether to include comments. Defaults to true.")
    }),
    execute: async ({ integrationId, issueId, includeComments = true }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_read_ticket tool", { integrationId, issueId, includeComments })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const linearIntegration = await db().linear_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!linearIntegration) {
            throw new Error(`Linear integration not found for integrationId: ${integrationId}`)
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(linearIntegration.id)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

        const client = new LinearClient({ accessToken })

        try {
            let issue = null

            if (isValidUuid(issueId)) {
                issue = await client.issue(issueId)
            } else {
                const searchResult = await client.searchIssues(issueId, { first: 1 })
                const first = searchResult.nodes[0]
                issue = first ? await client.issue(first.id) : null
            }

            if (!issue) {
                return {
                    success: false,
                    error: `Issue not found: ${issueId}`,
                    hint: "Check the issue ID or identifier (e.g. TEAM-123) is correct."
                }
            }

            // Fetch full issue by id so we have consistent Issue type (with comments())
            const fullIssue = await client.issue(issue.id)
            if (!fullIssue) {
                return {
                    success: false,
                    error: `Issue not found: ${issueId}`,
                    hint: "Check the issue ID or identifier (e.g. TEAM-123) is correct."
                }
            }

            const state = fullIssue.state ? await fullIssue.state : null
            const assignee = fullIssue.assignee ? await fullIssue.assignee : null
            const team = fullIssue.team ? await fullIssue.team : null
            const project = fullIssue.project ? await fullIssue.project : null

            const ticket = {
                id: fullIssue.id,
                identifier: fullIssue.identifier,
                title: fullIssue.title,
                description: fullIssue.description,
                state: state?.name ?? "Unknown",
                priority: issue.priority,
                assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email ?? undefined } : null,
                team: team ? { id: team.id, name: team.name, key: team.key } : null,
                project: project ? { id: project.id, name: project.name } : null,
                url: fullIssue.url,
                createdAt: fullIssue.createdAt,
                updatedAt: fullIssue.updatedAt,
                dueDate: fullIssue.dueDate ?? undefined,
                estimate: fullIssue.estimate ?? undefined
            }

            let comments: Array<{ id: string; body: string; authorId: string; createdAt: string }> = []
            if (includeComments) {
                const commentsResult = await fullIssue.comments()
                comments = await Promise.all(
                    commentsResult.nodes.map(async c => {
                        const user = c.user != null ? await c.user : null
                        return {
                            id: c.id,
                            body: c.body,
                            authorId: user?.id ?? "",
                            createdAt: c.createdAt.toISOString()
                        }
                    })
                )
            }

            const action = {
                action: "Read ticket",
                integration: IntegrationType.LINEAR,
                target: fullIssue.identifier,
                details: `${fullIssue.title}${includeComments && comments.length ? ` (${comments.length} comments)` : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                issue: ticket,
                comments: includeComments ? comments : undefined,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error reading Linear issue", { error: errorMessage, issueId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the access token is valid and the issue ID or identifier is correct."
            }
        }
    },
    errorFunction: formatError
})
