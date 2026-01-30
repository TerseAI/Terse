import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { IntegrationType } from "../../../shared/Integrations";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { RunHistoryActionType } from "@prisma/client";
import { formatError, createNeedsApprovalFunction } from "../../../tools/toolUtils";
import { ToolName } from "../../../tools/ToolNames";
import logger from "../../../logger";
import { AtlassianIntegrationManager } from "../../../integrations/AtlassianIntegration";
import { db } from "../../../prismaClient";
import { Session } from "../../../types/session";

// Atlassian Document Format (ADF) interfaces
interface ADFText {
    type: "text";
    text: string;
    marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

interface ADFParagraph {
    type: "paragraph";
    content: ADFText[];
}

interface ADFDocument {
    version: 1;
    type: "doc";
    content: ADFParagraph[];
}

// Helper function to convert plain text to Atlassian Document Format
function textToADF(text: string): ADFDocument {
    return {
        version: 1,
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: text
                    }
                ]
            }
        ]
    };
}

// Helper to find user accountId from email
async function findUserAccountId(cloudId: string, accessToken: string, email: string): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/user/search?query=${encodeURIComponent(email)}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            }
        );

        if (!response.ok) {
            logger.warn(`Failed to search for user by email: ${email}`, { status: response.status });
            return null;
        }

        const users = await response.json();
        if (users && users.length > 0) {
            return users[0].accountId;
        }
        return null;
    } catch (error) {
        logger.error(`Error searching for user by email: ${email}`, { error });
        return null;
    }
}

// Helper to get available transitions for an issue
async function getAvailableTransitions(cloudId: string, accessToken: string, issueKey: string): Promise<Array<{ id: string; name: string }>> {
    try {
        const response = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            }
        );

        if (!response.ok) {
            logger.warn(`Failed to get transitions for issue: ${issueKey}`, { status: response.status });
            return [];
        }

        const data = await response.json();
        return (data.transitions || []).map((t: any) => ({ id: t.id, name: t.name }));
    } catch (error) {
        logger.error(`Error getting transitions for issue: ${issueKey}`, { error });
        return [];
    }
}

export const jiraUpdateTicketTool = tool({
    name: ToolName.JIRA_UPDATE_TICKET,
    description: `Update an existing Jira issue/ticket. Use this tool to modify issue properties such as title, description, status, assignee, priority, labels, and due date.

BEFORE USING THIS TOOL:
- Use jira_search_ticket to find the issue key you want to update
- Ensure you have the correct issue key (e.g., "PROJ-123")

COMMON UPDATE OPERATIONS:
- Change status: Set status to move issue through workflow (e.g., "In Progress", "Done")
- Assign issue: Set assignee to assign to a user by email
- Update priority: Set priority (number, typically 1-5)
- Add/remove labels: Set labels to replace all labels, or use the labels array
- Set due date: Use dueDate in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd.
- Update description: Set description (supports plain text or markdown format)`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Atlassian/Jira integration to use.'),
        issueKey: z.string().describe('The key of the Jira issue to update (e.g., "PROJ-123"). This is required.'),
        title: z.string().nullable().optional().describe('The issue title/summary.'),
        description: z.string().nullable().optional().describe('The issue description in plain text or markdown format.'),
        status: z.string().nullable().optional().describe('The status name to transition to (e.g., "In Progress", "Done", "To Do").'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).optional().describe('The assignee of the ticket. Set to null to unassign.'),
        priority: z.union([z.number(), z.null()]).optional().describe('The priority of the ticket (number, typically 1-5).'),
        labels: z.union([z.array(z.string()), z.null()]).optional().describe('The labels for the ticket (array of label names). This replaces all existing labels.'),
        dueDate: z.string().nullable().optional().describe('The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd. Set to null to remove due date.'),
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.JIRA_UPDATE_TICKET),
    execute: async ({ 
        integrationId,
        issueKey,
        title,
        description,
        status,
        assignee,
        priority,
        labels,
        dueDate,
    }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug('🛠️ Executing jira_update_ticket tool', { integrationId, issueKey, updates: { title, description, status, assignee, priority, labels, dueDate } });

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const integrationManager = new AtlassianIntegrationManager();
        
        // Get valid access token with user ownership validation
        const userId = runContext.context.user.id;
        const accessToken = await integrationManager.getAccessToken(integrationId, userId);
        if (!accessToken) {
            throw new Error(`Atlassian integration not found or access denied for integrationId: ${integrationId}`);
        }

        // Get cloud_id and base_url from the integration
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId },
            select: { cloud_id: true, base_url: true, jira_user_email: true },
        });

        if (!integration || !integration.cloud_id) {
            throw new Error(`Atlassian integration details not found for integrationId: ${integrationId}`);
        }

        if (!integration.base_url) {
            throw new Error(`No base_url found in Atlassian integration for integrationId: ${integrationId}`);
        }

        const cloudId = integration.cloud_id;
        const baseUrl = integration.base_url;

        try {
            // Build the update fields object
            const fields: Record<string, any> = {};

            if (title !== undefined && title !== null) {
                fields.summary = title;
            }

            if (description !== undefined && description !== null) {
                fields.description = textToADF(description);
            }

            // Handle assignee
            if (assignee !== undefined) {
                if (assignee === null) {
                    // Unassign
                    fields.assignee = null;
                } else if (assignee.email) {
                    const accountId = await findUserAccountId(cloudId, accessToken, assignee.email);
                    if (accountId) {
                        fields.assignee = { accountId };
                    } else {
                        logger.warn(`Could not find user with email: ${assignee.email}`);
                    }
                }
            }

            // Handle priority
            if (priority !== undefined && priority !== null) {
                fields.priority = { id: priority.toString() };
            } else if (priority === null) {
                // Remove priority
                fields.priority = null;
            }

            // Handle labels
            if (labels !== undefined) {
                if (labels === null) {
                    fields.labels = [];
                } else {
                    fields.labels = labels;
                }
            }

            // Handle due date
            if (dueDate !== undefined) {
                if (dueDate === null) {
                    fields.duedate = null;
                } else if (dueDate.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
                    // Only set due date if it's not empty and matches yyyy-MM-dd format
                    fields.duedate = dueDate;
                } else {
                    logger.warn(`Invalid due date format: "${dueDate}". Expected format: yyyy-MM-dd. Skipping due date update.`);
                }
            }

            // Update the issue fields if any were provided
            if (Object.keys(fields).length > 0) {
                const updateResponse = await fetch(
                    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`,
                    {
                        method: "PUT",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ fields }),
                    }
                );

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    logger.error('❌ Error updating Jira issue fields', { status: updateResponse.status, error: errorText, issueKey });
                    throw new Error(`Failed to update Jira issue fields: ${errorText}`);
                }
            }

            // Handle status transition if provided
            if (status) {
                // First, get available transitions
                const transitions = await getAvailableTransitions(cloudId, accessToken, issueKey);
                
                // Find the transition that matches the status name
                const matchingTransition = transitions.find(t => 
                    t.name.toLowerCase() === status.toLowerCase()
                );

                if (matchingTransition) {
                    const transitionResponse = await fetch(
                        `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}/transitions`,
                        {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${accessToken}`,
                                "Accept": "application/json",
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                transition: { id: matchingTransition.id },
                            }),
                        }
                    );

                    if (!transitionResponse.ok) {
                        const errorText = await transitionResponse.text();
                        logger.error('❌ Error transitioning Jira issue', { status: transitionResponse.status, error: errorText, issueKey, targetStatus: status });
                        throw new Error(`Failed to transition Jira issue: ${errorText}`);
                    }
                } else {
                    logger.warn(`Could not find transition to status "${status}". Available transitions: ${transitions.map(t => t.name).join(', ')}`);
                    // Don't throw - continue with the update
                }
            }

            // Fetch the updated issue to return complete data
            const issueResponse = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                    },
                }
            );

            if (!issueResponse.ok) {
                logger.warn('Could not fetch updated issue details', { issueKey });
                // Return success anyway since the update succeeded
                return {
                    success: true,
                    issue: {
                        key: issueKey,
                        identifier: issueKey,
                    },
                    updatedFields: Object.keys(fields),
                };
            }

            const updatedIssue = await issueResponse.json();

            // Construct browse URL using the base_url from integration
            const issueUrl = `${baseUrl}/browse/${issueKey}`;

            // Extract issue data
            const issueData = {
                id: updatedIssue.id,
                key: issueKey,
                identifier: issueKey,
                title: updatedIssue.fields.summary || title || '',
                description: updatedIssue.fields.description || description || undefined,
                state: updatedIssue.fields.status ? {
                    id: updatedIssue.fields.status.id,
                    name: updatedIssue.fields.status.name,
                } : { id: '', name: 'Unknown' },
                priority: updatedIssue.fields.priority ? parseInt(updatedIssue.fields.priority.id) : priority || undefined,
                assignee: updatedIssue.fields.assignee ? {
                    id: updatedIssue.fields.assignee.accountId,
                    name: updatedIssue.fields.assignee.displayName,
                    email: updatedIssue.fields.assignee.emailAddress || undefined,
                } : null,
                labels: updatedIssue.fields.labels || labels || [],
                dueDate: updatedIssue.fields.duedate || dueDate || undefined,
                project: updatedIssue.fields.project ? {
                    id: updatedIssue.fields.project.id,
                    name: updatedIssue.fields.project.name,
                    key: updatedIssue.fields.project.key,
                } : undefined,
                url: issueUrl,
                createdAt: updatedIssue.fields.created || undefined,
                updatedAt: updatedIssue.fields.updated || undefined,
            };

            // Return action as part of the result
            const updateSummary = Object.keys(fields).join(', ') + (status ? ', status' : '');
            const action = {
                action: 'Updated ticket',
                integration: IntegrationType.ATLASSIAN,
                target: issueKey,
                details: `Updated fields: ${updateSummary}`,
                url: issueUrl,
                type: RunHistoryActionType.update,
            };

            return {
                success: true,
                actions: [action],
                issue: issueData,
                updatedFields: Object.keys(fields).concat(status ? ['status'] : []),
            };
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error);
            throw new Error(errorMessage);
        }
    },
    errorFunction: formatError
});

