import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import chalk from "chalk";
import { StructuredSearchOptions } from "../../ticketing/TicketIntegration";
import { CreateTicketInput, Ticket, TicketSystemType, UserContext } from "../../shared/TicketSystem";
import { SessionWithTracking } from "../agents/Analyzer";
import { EntityType } from "../../shared/Entities";
import { ChangeEventType } from "../../shared/ModelEvents";

const searchJiraTicketTool = tool({
    name: 'Search Jira Ticket',
    description: 'Search for a Jira ticket using JQL or text search',
    parameters: z.object({
        query: z.string().describe('The JQL query or text to search for'),
        projectIds: z.union([z.array(z.string()), z.null()]).describe('Filter by Jira project IDs'),
        assigneeEmails: z.union([z.array(z.string()), z.null()]).describe('MUST BE A VALID EMAIL. Filter by assignee emails.'),
        createdByEmails: z.union([z.array(z.string()), z.null()]).describe('MUST BE A VALID EMAIL. Filter by created by emails.'),
        statusIds: z.union([z.array(z.string()), z.null()]).describe('Filter by Jira status IDs'),
        priority: z.union([z.array(z.number()), z.null()]).describe('Filter by priority levels'),
        labels: z.union([z.array(z.string()), z.null()]).describe('Filter by Jira label names'),
        dueDateRange: z.union([z.object({
            from: z.union([z.string(), z.null()]).describe('Due date from (ISO string)'),
            to: z.union([z.string(), z.null()]).describe('Due date to (ISO string)')
        }), z.null()]).describe('Filter by due date range'),
        createdDateRange: z.union([z.object({
            from: z.union([z.string(), z.null()]).describe('Created date from (ISO string)'),
            to: z.union([z.string(), z.null()]).describe('Created date to (ISO string)')
        }), z.null()]).describe('Filter by created date range'),
        limit: z.union([z.number(), z.null()]).describe('Maximum number of results to return')
    }),
    execute: async ({ query, projectIds, assigneeEmails, createdByEmails, statusIds, priority, labels, dueDateRange, createdDateRange, limit }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        // filter out invalid emails
        if (assigneeEmails) {
            assigneeEmails = assigneeEmails.filter(email => email.includes('@'));
        }
        if (createdByEmails) {
            createdByEmails = createdByEmails.filter(email => email.includes('@'));
        }
        
        let ticketManager = runContext.context.ticketManager;

        // Build JQL query for Jira
        let jql = query;
        
        if (projectIds && projectIds.length > 0) {
            jql += ` AND project IN (${projectIds.map(id => `"${id}"`).join(', ')})`;
        }
        
        if (assigneeEmails && assigneeEmails.length > 0) {
            jql += ` AND assignee IN (${assigneeEmails.map(email => `"${email}"`).join(', ')})`;
        }
        
        if (statusIds && statusIds.length > 0) {
            jql += ` AND status IN (${statusIds.map(id => `"${id}"`).join(', ')})`;
        }

        const options: StructuredSearchOptions = {
            teamIds: projectIds || undefined, // Map projectIds to teamIds for compatibility
            assigneeEmails: assigneeEmails || undefined,
            createdByEmails: createdByEmails || undefined,
            stateIds: statusIds || undefined, // Map statusIds to stateIds for compatibility
            priority: priority || undefined,
            labels: labels || undefined,
            dueDateRange: dueDateRange ? {
                from: dueDateRange.from ? new Date(dueDateRange.from) : undefined,
                to: dueDateRange.to ? new Date(dueDateRange.to) : undefined
            } : undefined,
            createdDateRange: createdDateRange ? {
                from: createdDateRange.from ? new Date(createdDateRange.from) : undefined,
                to: createdDateRange.to ? new Date(createdDateRange.to) : undefined
            } : undefined,
            limit: limit || undefined
        };

        console.log('Jira Ticket Tool: Searching for tickets with JQL:', jql, 'and options:', options);
        const tickets = await ticketManager.structuredSearch(jql, options);
        
        return {
            tickets: tickets.map(ticket => ({
                id: ticket.id,
                identifier: ticket.identifier,
                title: ticket.title,
                description: ticket.description,
                state: ticket.state,
                assignee: ticket.assignee,
                priority: ticket.priority,
                estimate: ticket.estimate,
                dueDate: ticket.dueDate,
                project: ticket.project,
                team: ticket.team,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            }))
        };
    }
});

const getJiraCurrentUserTool = tool({
    name: 'Get Jira Current User',
    description: 'Get the current Jira user',
    parameters: z.object({}),
    execute: async (_, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        console.log('Jira Ticket Tool: Getting current user');

        let ticketManager = runContext.context.ticketManager;

        return await ticketManager.me();
    }
});

const getJiraIssueTypesTool = tool({
    name: 'Get Jira Issue Types',
    description: 'Get available Jira issue types',
    parameters: z.object({
        projectKey: z.union([z.string(), z.null()]).describe('Optional project key to get issue types for a specific project'),
    }),
    execute: async ({ projectKey }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        console.log('Jira Ticket Tool: Getting issue types');

        let ticketManager = runContext.context.ticketManager;

        // Cast to JiraAdapter to access getIssueTypes method
        const jiraAdapter = ticketManager as any;
        if (jiraAdapter.getIssueTypes) {
            return await jiraAdapter.getIssueTypes(projectKey || undefined);
        } else {
            // Fallback to common issue types
            return [
                { id: '10000', name: 'Task', description: 'A task that needs to be done' },
                { id: '10001', name: 'Bug', description: 'A problem which impairs or prevents the functions of the product' },
                { id: '10002', name: 'Story', description: 'A user story' },
                { id: '10003', name: 'Epic', description: 'A big user story that needs to be broken down' },
                { id: '10004', name: 'Subtask', description: 'A sub-task of the parent issue' },
                { id: '10005', name: 'Improvement', description: 'An improvement or enhancement to an existing feature' },
                { id: '10006', name: 'New Feature', description: 'A new feature of the product' }
            ];
        }
    }
});

const createJiraTicketTool = tool({
    name: 'Create Jira Ticket',
    description: 'Create a new Jira ticket',
    parameters: z.object({
        title: z.string().describe('The title/summary of the Jira ticket'),
        description: z.union([z.string(), z.null()]).describe('The description of the Jira ticket'),
        projectKey: z.string().describe('The Jira project key (e.g., "PROJ", "TEAM")'),
        issueType: z.string().describe('The Jira issue type (e.g., "Task", "Bug", "Story", "Epic", "Subtask", "Improvement", "New Feature")').default('Task'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).describe('The assignee of the ticket'),
        priority: z.union([z.number(), z.null()]).describe('The priority of the ticket'),
        labels: z.union([z.array(z.string()), z.null()]).describe('The labels for the ticket (array of label names)'),
        estimate: z.union([z.number(), z.null()]).describe('The time estimate for the ticket (in seconds)'),
        dueDate: z.union([z.string(), z.null()]).describe('The due date for the ticket (YYYY-MM-DD format)'),
        associatedCommits: z.union([z.array(z.number()), z.null()]).describe('The indices of commits to associate with this ticket (0-based, from the event context)'),
    }),
    execute: async ({ title, description, projectKey, issueType, assignee, priority, labels, estimate, dueDate, associatedCommits }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        const ticketManager = runContext.context.ticketManager;

        // For Jira, we need to find the project ID from the project key
        const userContext = await ticketManager.getUserContext();
        const project = userContext.teams.find(team => team.key === projectKey);
        
        if (!project) {
            console.error(chalk.red.bold(`❌ Project with key "${projectKey}" not found. Available projects:`, userContext.teams.map(t => t.key).join(', ')));
            throw new Error(`Project with key "${projectKey}" not found`);
        }

        console.log('Jira Ticket Tool: Creating ticket in project:', projectKey);

        let ticket: Ticket;
        try {
        ticket = await ticketManager.createTicket({
            title,
            teamId: project.id, // Use project ID as teamId for compatibility
            description: description || undefined,
            assignee: assignee?.email || undefined,
            priority: priority || undefined,
            labels: labels ? labels.map(label => ({ id: label, name: label, color: '' })) : undefined,
            estimate: estimate || undefined,
            dueDate: dueDate || undefined,
            project: { id: project.key, name: project.name },
            issueType: issueType,
            associatedCommits: associatedCommits || undefined,
        } as CreateTicketInput);
        } catch (error) {
            console.error('Jira Ticket Tool: Error creating ticket:', error);
            throw new Error('Error creating ticket');
        }


        runContext?.context.trackChange(EntityType.TICKET, ticket.id, ChangeEventType.CREATED);

        return ticket;
    }
});

const updateJiraTicketTool = tool({
    name: 'Update Jira Ticket',
    description: 'Update an existing Jira ticket',
    parameters: z.object({
        id: z.string().describe('The ID or key of the Jira ticket (e.g., "PROJ-123")'),
        title: z.string().describe('The title/summary of the Jira ticket'),
        description: z.union([z.string(), z.null()]).describe('The description of the Jira ticket'),
        statusId: z.union([z.string(), z.null()]).describe('The Jira status ID to transition to'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).describe('The assignee of the ticket'),
        priority: z.union([z.number(), z.null()]).describe('The priority of the ticket'),
        labels: z.union([z.array(z.string()), z.null()]).describe('The labels for the ticket (array of label names)'),
        estimate: z.union([z.number(), z.null()]).describe('The time estimate for the ticket (in seconds)'),
        dueDate: z.union([z.string(), z.null()]).describe('The due date for the ticket (YYYY-MM-DD format)'),
        associatedCommits: z.union([z.array(z.number()), z.null()]).describe('The indices of commits to associate with this ticket (0-based, from the event context)'),
    }),
    execute: async ({ id, title, description, statusId, assignee, priority, labels, estimate, dueDate, associatedCommits }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        console.log('Jira Ticket Tool: Updating ticket:', id);

        // Validate status if provided
        if (statusId) {
            const userContext: UserContext = await ticketManager.getUserContext();
            if (!userContext.ticketStates.some(s => s.id === statusId)) {
                console.error(chalk.red.bold('❌ Invalid status ID. This will fail!'));
                throw new Error("Invalid status ID. Please use a valid status from the user context.");
            }
        }

        let ticket = await ticketManager.updateTicket(id, {
            title,
            description: description || undefined,
            state: statusId ? {
                id: statusId,
                name: statusId
            } : undefined,
            assignee: assignee?.email || undefined,
            priority: priority || undefined,
            teamId: '', // Not needed for Jira updates
        });



        runContext?.context.trackChange(EntityType.TICKET, ticket.id, ChangeEventType.UPDATED);

        return ticket;
    }
});

const findJiraIssueTool = tool({
    name: 'findJiraIssueWithId',
    description: "find a Jira issue/ticket by ID or key",
    parameters: z.object({
        issueId: z.string().describe('The ID or key of the Jira issue to find (e.g., "PROJ-123")'),
    }),
    execute: async ({ issueId }: { issueId: string }, runContext?: RunContext<SessionWithTracking>) => {
        console.log(chalk.cyan('\nFetching Jira issue with ID: ' + issueId));

        if (!runContext?.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        return await ticketManager.findTicket(issueId);
    },
});

const commentOnJiraTicketTool = tool({
    name: 'commentOnJiraTicket',
    description: "comment on a Jira ticket",
    parameters: z.object({
        issueId: z.string().describe('The ID or key of the Jira issue to comment on (e.g., "PROJ-123")'),
        comment: z.string().describe('The comment to add to the Jira ticket'),
    }),
    execute: async ({ issueId, comment }: { issueId: string, comment: string }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        console.log(chalk.cyan('\nCommenting on Jira ticket: ' + issueId));

        return await ticketManager.commentOnTicket(issueId, comment);
    },
});

export const jiraTicketTools = [
    createJiraTicketTool, 
    updateJiraTicketTool, 
    findJiraIssueTool, 
    searchJiraTicketTool, 
    getJiraCurrentUserTool, 
    getJiraIssueTypesTool,
    commentOnJiraTicketTool
]; 