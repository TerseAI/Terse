import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";
import chalk from "chalk";
import { IntegrationType } from "../../../shared/Integrations";
import { LinearTicketSession } from "../LinearTicketOutput";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import type { IssueUpdateInput } from "@linear/sdk/dist/_generated_documents";
import { RunHistoryActionType } from "@prisma/client";
import { formatError, needsApproval } from "../../../tools/toolUtils";

export const linearUpdateTicketTool = tool({
    name: 'linear_update_ticket',
    description: `Update an existing Linear issue/ticket. Use this tool to modify issue properties such as title, description, state, assignee, priority, labels, due date, and more.

BEFORE USING THIS TOOL:
- Use linear_search_ticket to find the issue ID you want to update
- Ensure you have the correct issue ID (not the identifier, but the actual ID)

COMMON UPDATE OPERATIONS:
- Change state: Set stateId to move issue through workflow (e.g., "In Progress", "Done")
- Assign issue: Set assigneeId to assign to a user
- Update priority: Set priority (0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low)
- Add labels: Use addedLabelIds to add labels to the issue
- Remove labels: Use removedLabelIds to remove labels from the issue
- Set due date: Use dueDate in format "YYYY-MM-DD" (TimelessDate format)
- Update description: Set description (supports markdown format)`,
    parameters: z.object({
        issueId: z.string().describe('The ID of the Linear issue to update. Use linear_search_ticket or linear_get_ticket to find the issue ID.'),
        title: z.string().nullable().optional().describe('The issue title.'),
        description: z.string().nullable().optional().describe('The issue description in markdown format.'),
        stateId: z.string().nullable().optional().describe('The ID of the team state to set (e.g., "In Progress", "Done"). Use linear_get_ticket to find available state IDs.'),
        assigneeId: z.string().nullable().optional().describe('The ID of the user to assign the issue to.'),
        priority: z.number().nullable().optional().describe('The priority of the issue. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low.'),
        dueDate: z.string().nullable().optional().describe('The date at which the issue is due, in format "YYYY-MM-DD" (TimelessDate format).'),
        labelIds: z.array(z.string()).nullable().optional().describe('The identifiers of the issue labels to associate with this ticket (replaces existing labels).'),
        addedLabelIds: z.array(z.string()).nullable().optional().describe('The identifiers of the issue labels to be added to this issue.'),
        removedLabelIds: z.array(z.string()).nullable().optional().describe('The identifiers of the issue labels to be removed from this issue.'),
        projectId: z.string().nullable().optional().describe('The ID of the project to associate with the issue.'),
        projectMilestoneId: z.string().nullable().optional().describe('The ID of the project milestone to associate with the issue.'),
        teamId: z.string().nullable().optional().describe('The ID of the team to associate with the issue.'),
        parentId: z.string().nullable().optional().describe('The ID of the parent issue (to make this a sub-issue).'),
        estimate: z.number().nullable().optional().describe('The estimated complexity of the issue.'),
        subscriberIds: z.array(z.string()).nullable().optional().describe('The IDs of users subscribing to this ticket.'),
        trashed: z.boolean().nullable().optional().describe('Whether the issue has been trashed.'),
    }),
    needsApproval,
    execute: async ({ 
        issueId, 
        title, 
        description, 
        stateId, 
        assigneeId, 
        priority, 
        dueDate, 
        labelIds, 
        addedLabelIds, 
        removedLabelIds, 
        projectId, 
        projectMilestoneId, 
        teamId, 
        parentId, 
        estimate, 
        subscriberIds, 
        trashed 
    }, runContext?: RunContext<SessionWithTracking<LinearTicketSession>>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing linear_update_ticket tool'));
        console.log(chalk.cyan('  Issue ID: '), chalk.greenBright(issueId));
        console.log(chalk.cyan('  Updates: '), chalk.yellow(JSON.stringify({
            title, description, stateId, assigneeId, priority, dueDate,
            labelIds, addedLabelIds, removedLabelIds, projectId, projectMilestoneId,
            teamId, parentId, estimate, subscriberIds, trashed
        }, null, 2)));

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get the OAuth token from the Linear integration
        const accessToken = runContext.context.linearIntegration.access_token;
        if (!accessToken) {
            throw new Error("No access token found in Linear integration");
        }

        // Initialize Linear client with OAuth token
        const client = new LinearClient({
            accessToken
        });

        try {
            // Build the update input object, only including provided fields with actual values
            // Filter out empty strings, null values for fields that don't accept null, and undefined
            const updateInput: Partial<IssueUpdateInput> = {};

            // Helper to check if a value should be included (not undefined, not empty string)
            const hasValue = (value: any): boolean => {
                return value !== undefined && value !== null && value !== '';
            };

            if (hasValue(title)) updateInput.title = title as string;
            if (hasValue(description)) updateInput.description = description as string;
            if (hasValue(stateId)) updateInput.stateId = stateId as string;
            if (hasValue(assigneeId)) updateInput.assigneeId = assigneeId as string;
            if (priority !== undefined && priority !== null) updateInput.priority = priority;
            if (hasValue(dueDate)) updateInput.dueDate = dueDate as string;
            if (labelIds !== undefined && labelIds !== null && labelIds.length > 0) updateInput.labelIds = labelIds;
            if (addedLabelIds !== undefined && addedLabelIds !== null && addedLabelIds.length > 0) updateInput.addedLabelIds = addedLabelIds;
            if (removedLabelIds !== undefined && removedLabelIds !== null && removedLabelIds.length > 0) updateInput.removedLabelIds = removedLabelIds;
            if (hasValue(projectId)) updateInput.projectId = projectId as string;
            if (hasValue(projectMilestoneId)) updateInput.projectMilestoneId = projectMilestoneId as string;
            if (hasValue(teamId)) updateInput.teamId = teamId as string;
            if (hasValue(parentId)) updateInput.parentId = parentId as string;
            if (estimate !== undefined && estimate !== null) updateInput.estimate = estimate;
            if (subscriberIds !== undefined && subscriberIds !== null && subscriberIds.length > 0) updateInput.subscriberIds = subscriberIds;
            // Only send trashed if it's explicitly true (to trash an issue)
            // Don't send trashed: false as Linear may not handle it well
            if (trashed === true) updateInput.trashed = true;

            // Check if any fields were provided
            if (Object.keys(updateInput).length === 0) {
                return {
                    success: false,
                    error: 'No update fields provided',
                    hint: 'Provide at least one field to update (e.g., title, description, stateId, etc.)'
                };
            }

            // Update the issue using updateIssue method
            const issuePayload = await client.updateIssue(issueId, updateInput);

            // Get the updated issue
            const updatedIssue = await issuePayload.issue;
            if (!updatedIssue) {
                throw new Error('Failed to update issue - no issue returned');
            }

            // Await LinearFetch objects for state and assignee
            const state = await updatedIssue.state;
            const assignee = updatedIssue.assignee ? await updatedIssue.assignee : null;

            // Extract issue data
            const issueData = {
                id: updatedIssue.id,
                identifier: updatedIssue.identifier,
                title: updatedIssue.title,
                description: updatedIssue.description,
                state: state?.name || 'Unknown',
                priority: updatedIssue.priority,
                assignee: assignee ? {
                    id: assignee.id,
                    name: assignee.name,
                    email: assignee.email || undefined,
                } : null,
                url: updatedIssue.url,
                createdAt: updatedIssue.createdAt,
                updatedAt: updatedIssue.updatedAt,
            };

            // Track the action
            const updateSummary = Object.keys(updateInput).join(', ');
            runContext.context.trackAction({
                action: 'Updated ticket',
                integration: IntegrationType.LINEAR,
                target: updatedIssue.identifier || issueId,
                details: `Updated fields: ${updateSummary}`,
                url: updatedIssue.url,
                type: RunHistoryActionType.update,
            });

            return {
                success: true,
                issue: issueData,
                updatedFields: Object.keys(updateInput),
            };
        } catch (error: unknown) {
            console.error(chalk.red('❌ Error updating Linear issue:'), error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to update Linear issue';
            return {
                success: false,
                error: errorMessage,
                hint: 'Check that the issue ID is valid, the access token has the necessary permissions, and all provided IDs (stateId, assigneeId, etc.) are valid',
            };
        }
    },
    errorFunction: formatError
});

