import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { IntegrationType } from "../../../shared/Integrations";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { RunHistoryActionType } from "@prisma/client";
import { formatError, needsApproval } from "../../../tools/toolUtils";
import logger from "../../../logger";
import { AtlassianIntegrationManager } from "../../../integrations/AtlassianIntegration";
import { db } from "../../../prismaClient";
import { Session } from "../../../server";

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

export const jiraCreateTicketTool = tool({
    name: 'jira_create_ticket',
    description: `Create a new Jira issue/ticket. Use this tool to create new issues in Jira with a title, description, and optional metadata.

REQUIRED FIELDS:
- title: The issue title/summary (required)
- projectKey: The Jira project key (e.g., "PROJ", "TEAM") (required)

OPTIONAL FIELDS:
- description: The issue description in plain text or markdown format
- issueType: The Jira issue type (e.g., "Task", "Bug", "Story", "Epic", "Subtask", "Improvement", "New Feature"). Defaults to "Task"
- assignee: The assignee email address
- priority: The priority level (number, typically 1-5)
- labels: Array of label names to associate with the issue
- dueDate: The due date in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd.

BEFORE USING THIS TOOL:
- Ensure you have the correct projectKey for the project where you want to create the issue`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Atlassian/Jira integration to use.'),
        title: z.string().describe('The issue title/summary. This is required.'),
        description: z.string().nullable().optional().describe('The issue description in plain text or markdown format.'),
        projectKey: z.string().describe('The Jira project key (e.g., "PROJ", "TEAM"). This is required.'),
        issueType: z.string().nullable().optional().describe('The Jira issue type (e.g., "Task", "Bug", "Story", "Epic", "Subtask", "Improvement", "New Feature")').default('Task'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).optional().describe('The assignee of the ticket'),
        priority: z.union([z.number(), z.null()]).optional().describe('The priority of the ticket (number, typically 1-5)'),
        labels: z.union([z.array(z.string()), z.null()]).optional().describe('The labels for the ticket (array of label names)'),
        dueDate: z.string().nullable().optional().describe('The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd.'),
    }),
    needsApproval,
    execute: async ({ 
        integrationId,
        title,
        description,
        projectKey,
        issueType = 'Task',
        assignee,
        priority,
        labels,
        dueDate,
    }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug('🛠️ Executing jira_create_ticket tool', { title, projectKey, issueType, otherFields: { description, assignee, priority, labels, dueDate } });

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get the integration details
        const integrationManager = new AtlassianIntegrationManager();
        
        // Get valid access token with user ownership validation
        const userId = runContext.context.user.id;
        const accessToken = await integrationManager.getAccessToken(integrationId, userId);
        if (!accessToken) {
            throw new Error("No valid access token found for Jira integration");
        }

        // Get cloud_id and base_url from the integration
        const integration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId },
            select: { cloud_id: true, base_url: true },
        });

        if (!integration || !integration.cloud_id) {
            throw new Error("No cloud_id found in Jira integration");
        }

        if (!integration.base_url) {
            throw new Error("No base_url found in Jira integration");
        }

        const cloudId = integration.cloud_id;
        const baseUrl = integration.base_url;

        // Project key is required (enforced by schema)
        const finalProjectKey = projectKey;

        try {
            // Build the issue fields
            const fields: Record<string, any> = {
                summary: title,
                project: { key: finalProjectKey },
                issuetype: { name: issueType },
            };

            // Add description if provided
            if (description) {
                fields.description = textToADF(description);
            }

            // Add assignee if provided
            if (assignee?.email) {
                const accountId = await findUserAccountId(cloudId, accessToken, assignee.email);
                if (accountId) {
                    fields.assignee = { accountId };
                } else {
                    logger.warn(`Could not find user with email: ${assignee.email}`);
                }
            }

            // Add priority if provided
            if (priority !== undefined && priority !== null) {
                // Jira priority is typically an object with id, but we can try with just the number
                // The API might accept it as a number or we may need to map it
                fields.priority = { id: priority.toString() };
            }

            // Add labels if provided
            if (labels && labels.length > 0) {
                fields.labels = labels;
            }

            // Add due date if provided and valid
            if (dueDate && dueDate.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
                fields.duedate = dueDate;
            } else if (dueDate && (dueDate.trim() === '' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
                logger.warn(`Invalid due date format: "${dueDate}". Expected format: yyyy-MM-dd. Skipping due date.`);
            }

            // Create the issue using REST API
            const response = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ fields }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ Error creating Jira issue', { status: response.status, error: errorText, projectKey, title });
                throw new Error(`Failed to create Jira issue: ${errorText}`);
            }

            const createdIssue = await response.json();

            // Fetch the full issue details to get all fields
            const issueResponse = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${createdIssue.key}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                    },
                }
            );

            if (!issueResponse.ok) {
                logger.warn('Could not fetch full issue details, using basic info', { issueKey: createdIssue.key });
            }

            const fullIssue = issueResponse.ok ? await issueResponse.json() : null;

            // Construct browse URL using the base_url from integration
            const issueUrl = `${baseUrl}/browse/${createdIssue.key}`;

            // Extract issue data
            const issueData = {
                id: fullIssue?.id || createdIssue.id,
                key: createdIssue.key,
                identifier: createdIssue.key,
                title: fullIssue?.fields?.summary || title,
                description: fullIssue?.fields?.description || description || undefined,
                state: fullIssue?.fields?.status ? {
                    id: fullIssue.fields.status.id,
                    name: fullIssue.fields.status.name,
                } : { id: '', name: 'Unknown' },
                priority: fullIssue?.fields?.priority ? parseInt(fullIssue.fields.priority.id) : priority || undefined,
                assignee: fullIssue?.fields?.assignee ? {
                    id: fullIssue.fields.assignee.accountId,
                    name: fullIssue.fields.assignee.displayName,
                    email: fullIssue.fields.assignee.emailAddress || undefined,
                } : null,
                labels: fullIssue?.fields?.labels || labels || [],
                dueDate: fullIssue?.fields?.duedate || dueDate || undefined,
                project: fullIssue?.fields?.project ? {
                    id: fullIssue.fields.project.id,
                    name: fullIssue.fields.project.name,
                    key: fullIssue.fields.project.key,
                } : { id: '', name: '', key: projectKey },
                url: issueUrl,
                createdAt: fullIssue?.fields?.created || new Date().toISOString(),
                updatedAt: fullIssue?.fields?.updated || new Date().toISOString(),
            };

            // Return action as part of the result
            const action = {
                action: 'Created ticket',
                integration: IntegrationType.ATLASSIAN,
                target: createdIssue.key,
                details: `Created issue: ${title}`,
                url: issueData.url,
                type: RunHistoryActionType.create,
            };
            
            logger.debug('[jira_create_ticket] Returning action in result', {
                userId: runContext?.context?.user?.id || 'unknown',
                action,
            });

            return {
                success: true,
                issue: issueData,
                actions: [action],
            };
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error);
            throw new Error(errorMessage);
        }
    },
    errorFunction: formatError
});
