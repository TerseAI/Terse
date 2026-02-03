import { LinearClient } from "@linear/sdk"
import type { IssueCreateInput } from "@linear/sdk/dist/_generated_documents"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { AgentOutputWithConfigs } from "../../../types/prisma"
import { Session } from "../../../types/session"

export const linearCreateTicketTool = tool({
    name: ToolName.LINEAR_CREATE_TICKET,
    description: `Create a new Linear issue/ticket. Use this tool to create new issues in Linear with a title, description, and optional metadata.

REQUIRED FIELDS:
- title: The issue title (required)
- teamId: The ID of the team to create the issue in (required)

OPTIONAL FIELDS:
- description: The issue description in markdown format
- stateId: The ID of the initial state (e.g., "In Progress", "Todo")
- assigneeId: The ID of the user to assign the issue to
- priority: The priority (0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low)
- dueDate: The due date in format "YYYY-MM-DD" (TimelessDate format)
- labelIds: Array of label IDs to associate with the issue
- projectId: The ID of the project to associate with the issue
- projectMilestoneId: The ID of the project milestone to associate with the issue
- parentId: The ID of the parent issue (to create a sub-issue)
- estimate: The estimated complexity of the issue
- subscriberIds: Array of user IDs subscribing to this ticket

BEFORE USING THIS TOOL:
- Use linear_search_ticket to find team IDs, state IDs, and other IDs you might need
- Ensure you have the correct teamId for the team where you want to create the issue`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
        teamId: z
            .string()
            .nullable()
            .optional()
            .describe("The ID of the team to create the issue in. If not provided, will use the team configured in the Linear output settings. Use linear_search_ticket to find available teams."),
        title: z.string().describe("The issue title. This is required."),
        description: z.string().nullable().optional().describe("The issue description in markdown format."),
        stateId: z.string().nullable().optional().describe('The ID of the team state to set as initial state (e.g., "In Progress", "Todo"). Use linear_search_ticket to find available state IDs.'),
        assigneeId: z.string().nullable().optional().describe("The ID of the user to assign the issue to."),
        priority: z.number().nullable().optional().describe("The priority of the issue. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low."),
        dueDate: z.string().nullable().optional().describe('The date at which the issue is due, in format "YYYY-MM-DD" (TimelessDate format).'),
        labelIds: z.array(z.string()).nullable().optional().describe("The identifiers of the issue labels to associate with this ticket."),
        projectId: z.string().nullable().optional().describe("The ID of the project to associate with the issue."),
        projectMilestoneId: z.string().nullable().optional().describe("The ID of the project milestone to associate with the issue."),
        parentId: z.string().nullable().optional().describe("The ID of the parent issue (to create a sub-issue)."),
        estimate: z
            .number()
            .nullable()
            .optional()
            .describe(
                "The estimated complexity/story points of the issue. IMPORTANT: Do NOT set estimate to 0 - many Linear teams disallow 0 estimates. Valid values are positive numbers (1, 2, 3, 5, 8, etc.) or null/omit to skip. Only set an estimate if you have a meaningful value."
            ),
        subscriberIds: z.array(z.string()).nullable().optional().describe("The IDs of users subscribing to this ticket.")
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.LINEAR_CREATE_TICKET),
    execute: async (
        { integrationId, teamId, title, description, stateId, assigneeId, priority, dueDate, labelIds, projectId, projectMilestoneId, parentId, estimate, subscriberIds },
        runContext?: RunContext<SessionWithTracking<Session>>
    ) => {
        logger.debug("🛠️ Executing linear_create_ticket tool", {
            integrationId,
            title,
            teamId: teamId || "not provided",
            otherFields: { description, stateId, assigneeId, priority, dueDate, labelIds, projectId, projectMilestoneId, parentId, estimate, subscriberIds }
        })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

        // Initialize Linear client with OAuth token
        const client = new LinearClient({
            accessToken
        })

        try {
            // Use teamId from parameter, or get from config if available
            let finalTeamId = teamId
            if (!finalTeamId) {
                // Try to get from config if available
                const channelOutput = (runContext.context as any).channelOutput
                if (channelOutput?.linear_config?.team_id) {
                    finalTeamId = channelOutput.linear_config.team_id
                }
            }
            if (!finalTeamId) {
                return {
                    success: false,
                    error: "teamId is required. Either provide it in the tool call or configure it in the Linear output settings.",
                    hint: "Set a default team in the Linear output configuration, or provide teamId when creating the ticket"
                }
            }

            // Build the create input object, only including provided fields with actual values
            // Filter out empty strings, null values for fields that don't accept null, and undefined
            const createInput: Partial<IssueCreateInput> = {
                title,
                teamId: finalTeamId
            }

            // Helper to check if a value should be included (not undefined, not empty string)
            const hasValue = (value: any): boolean => {
                return value !== undefined && value !== null && value !== ""
            }

            if (hasValue(description)) createInput.description = description as string
            if (hasValue(stateId)) createInput.stateId = stateId as string
            if (hasValue(assigneeId)) createInput.assigneeId = assigneeId as string
            if (priority !== undefined && priority !== null) createInput.priority = priority
            if (hasValue(dueDate)) createInput.dueDate = dueDate as string
            if (labelIds !== undefined && labelIds !== null && labelIds.length > 0) createInput.labelIds = labelIds
            if (hasValue(projectId)) createInput.projectId = projectId as string
            if (hasValue(projectMilestoneId)) createInput.projectMilestoneId = projectMilestoneId as string
            if (hasValue(parentId)) createInput.parentId = parentId as string
            // Only include estimate if it's a positive number - 0 is often invalid in Linear teams
            if (estimate !== undefined && estimate !== null && estimate > 0) createInput.estimate = estimate
            if (subscriberIds !== undefined && subscriberIds !== null && subscriberIds.length > 0) createInput.subscriberIds = subscriberIds

            // Create the issue using createIssue method
            const issuePayload = await client.createIssue(createInput as IssueCreateInput)

            // Get the created issue
            const createdIssue = await issuePayload.issue
            if (!createdIssue) {
                throw new Error("Failed to create issue - no issue returned")
            }

            // Await LinearFetch objects for state and assignee
            const state = await createdIssue.state
            const assignee = createdIssue.assignee ? await createdIssue.assignee : null

            // Extract issue data
            const issueData = {
                id: createdIssue.id,
                identifier: createdIssue.identifier,
                title: createdIssue.title,
                description: createdIssue.description,
                state: state?.name || "Unknown",
                priority: createdIssue.priority,
                assignee: assignee
                    ? {
                          id: assignee.id,
                          name: assignee.name,
                          email: assignee.email || undefined
                      }
                    : null,
                url: createdIssue.url,
                createdAt: createdIssue.createdAt,
                updatedAt: createdIssue.updatedAt
            }

            // Return action as part of the result
            const action = {
                action: "Created ticket",
                integration: IntegrationType.LINEAR,
                target: createdIssue.identifier,
                details: `Created issue: ${title}`,
                url: createdIssue.url,
                type: RunHistoryActionType.create
            }

            logger.debug("[linear_create_ticket] Returning action in result", {
                userId: runContext?.context?.user?.id || "unknown",
                action
            })

            return {
                success: true,
                issue: issueData,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error creating Linear issue", { error: errorMessage, title, teamId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the teamId is valid, the access token has the necessary permissions, and all provided IDs (stateId, assigneeId, etc.) are valid"
            }
        }
    },
    errorFunction: formatError
})
