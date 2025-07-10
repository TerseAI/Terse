import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import chalk from "chalk";
import { StructuredSearchOptions } from "../../ticketing/TicketIntegration";
import { CreateTicketInput, UserContext } from "../../shared/TicketSystem";
import { SessionWithTracking } from "../agents/Analyzer";
import { EntityType } from "../../shared/Entities";
import { ChangeEventType } from "../../shared/ModelEvents";

const searchTicketTool = tool({
    name: 'Search Ticket',
    description: 'Search for a ticket',
    parameters: z.object({
        query: z.string().describe('The query to search for'),
        teamIds: z.union([z.array(z.string()), z.null()]).describe('Filter by team IDs'),
        assigneeEmails: z.union([z.array(z.string()), z.null()]).describe('MUST BE A VALID EMAIL. Filter by assignee emails. You should use this if you are looking for a specific user. It helps narrow down the results tremendously.'),
        createdByEmails: z.union([z.array(z.string()), z.null()]).describe('MUST BE A VALID EMAIL. Filter by created by emails. You should use this if you are looking for a specific user. It helps narrow down the results tremendously.'),
        stateIds: z.union([z.array(z.string()), z.null()]).describe('Filter by state IDs'),
        priority: z.union([z.array(z.number()), z.null()]).describe('Filter by priority levels'),
        labels: z.union([z.array(z.string()), z.null()]).describe('Filter by label names'),
        projects: z.union([z.array(z.string()), z.null()]).describe('Filter by project IDs'),
        dueDateRange: z.union([z.object({
            from: z.union([z.string(), z.null()]).describe('Due date from (ISO string)'),
            to: z.union([z.string(), z.null()]).describe('Due date to (ISO string)')
        }), z.null()]).describe('Filter by due date range'),
        createdDateRange: z.union([z.object({
            from: z.union([z.string(), z.null()]).describe('Created date from (ISO string)'),
            to: z.union([z.string(), z.null()]).describe('Created date to (ISO string)')
        }), z.null()]).describe('Filter by created date range'),
        updatedDateRange: z.union([z.object({
            from: z.union([z.string(), z.null()]).describe('Updated date from (ISO string)'),
            to: z.union([z.string(), z.null()]).describe('Updated date to (ISO string)')
        }), z.null()]).describe('Filter by updated date range'),
        sortBy: z.union([z.enum(['createdAt', 'updatedAt']), z.null()]).describe('Sort by field'),
        sortDirection: z.union([z.enum(['asc', 'desc']), z.null()]).describe('Sort direction'),
        limit: z.union([z.number(), z.null()]).describe('Maximum number of results to return'),
        includeArchived: z.union([z.boolean(), z.null()]).describe('Include archived tickets'),
        includeSubIssues: z.union([z.boolean(), z.null()]).describe('Include sub-issues'),
        includeComments: z.union([z.boolean(), z.null()]).describe('Include comments'),
        includeAttachments: z.union([z.boolean(), z.null()]).describe('Include attachments'),
        includeRelations: z.union([z.boolean(), z.null()]).describe('Include related tickets')
    }),
    execute: async ({ query, teamIds, assigneeEmails, createdByEmails, stateIds, priority, labels, projects, dueDateRange, createdDateRange, updatedDateRange, sortBy, sortDirection, limit, includeArchived, includeSubIssues, includeComments, includeAttachments, includeRelations }, runContext?: RunContext<SessionWithTracking>) => {
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

        // Convert date strings to Date objects if provided and handle null values
        const options: StructuredSearchOptions = {
            teamIds: teamIds || undefined,
            assigneeEmails: assigneeEmails || undefined,
            createdByEmails: createdByEmails || undefined,
            stateIds: stateIds || undefined,
            priority: priority || undefined,
            labels: labels || undefined,
            // projects: projects || undefined, // This seems dangerous. If tickets aren't in the project, they won't be found. And it could create duplicate tickets.
            dueDateRange: dueDateRange ? {
                from: dueDateRange.from ? new Date(dueDateRange.from) : undefined,
                to: dueDateRange.to ? new Date(dueDateRange.to) : undefined
            } : undefined,
            createdDateRange: createdDateRange ? {
                from: createdDateRange.from ? new Date(createdDateRange.from) : undefined,
                to: createdDateRange.to ? new Date(createdDateRange.to) : undefined
            } : undefined,
            updatedDateRange: updatedDateRange ? {
                from: updatedDateRange.from ? new Date(updatedDateRange.from) : undefined,
                to: updatedDateRange.to ? new Date(updatedDateRange.to) : undefined
            } : undefined,
            sortBy: sortBy || undefined,
            sortDirection: sortDirection || undefined,
            limit: limit || undefined,
            includeArchived: includeArchived || undefined,
            includeSubIssues: includeSubIssues || undefined,
            includeComments: includeComments || undefined,
            includeAttachments: includeAttachments || undefined,
            includeRelations: includeRelations || undefined
        };

        console.log('Ticket Tool: Searching for tickets with query and options:', query, options);
        const tickets = await ticketManager.structuredSearch(query, options);
        
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

const getCurrentUserTool = tool({
    name: 'Get Current User',
    description: 'Get the current user',
    parameters: z.object({}),
    execute: async (_, runContext?: RunContext<SessionWithTracking  >) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        console.log('Ticket Tool: Getting current user');

        let ticketManager = runContext.context.ticketManager;

        return await ticketManager.me();
    }
});


const createTicketTool = tool({
    name: 'Create Ticket',
    description: 'Create a new ticket',
    parameters: z.object({
        title: z.string().describe('The title of the ticket'),
        description: z.union([z.string(), z.null()]).describe('The description of the ticket'),
        state: z.object({
            id: z.string().describe('The state ID of the ticket'),
            name: z.string().describe('The state name of the ticket')
        }).describe('The state of the ticket'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).describe('The assignee of the ticket'),
        priority: z.union([z.number(), z.null()]).describe('The priority of the ticket'),
        labels: z.union([z.array(z.object({
            id: z.string().describe('The label ID'),
            name: z.string().describe('The label name'),
            color: z.string().describe('The label color')
        })), z.null()]).describe('The labels for the ticket'),
        estimate: z.union([z.number(), z.null()]).describe('The time estimate for the ticket'),
        dueDate: z.union([z.string(), z.null()]).describe('The due date for the ticket'),
        project: z.union([z.object({
            id: z.string().describe('The project ID'),
            name: z.string().describe('The project name')
        }), z.null()]).describe('The project for the ticket'),
    }),
    execute: async ({ title, description, state, assignee, priority, labels, estimate, dueDate, project }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        const teamId = runContext.context.teamId;
        if (!teamId) {
            console.error(chalk.red.bold('❌ No team ID provided. Unable to create ticket.'));
            throw new Error("No team ID provided");
        }

        let ticketManager = runContext.context.ticketManager;

        console.log('Ticket Tool: Created ticket');

        let ticket = await ticketManager.createTicket({
            title,
            teamId: teamId,
            description: description || undefined,
            state,
            assignee: assignee?.email || undefined,
            priority: priority || undefined,
            labels: labels || undefined,
            estimate: estimate || undefined,
            dueDate: dueDate || undefined,
            project: project || undefined,
        } as CreateTicketInput);

        runContext?.context.trackChange(EntityType.TICKET, ticket.id, ChangeEventType.CREATED);

        return ticket;
    }
});

const updateTicketTool = tool({
    name: 'Update Ticket',
    description: 'Update an existing ticket',
    parameters: z.object({
        id: z.string().describe('The ID of the ticket'),
        title: z.string().describe('The title of the ticket'),
        description: z.union([z.string(), z.null()]).describe('The description of the ticket'),
        state: z.string().describe('The state of the issue. This is just an ID from the user context. The name is not important.'),
        assignee: z.union([z.object({
            email: z.string().describe('The assignee email'),
        }), z.null()]).describe('The assignee of the ticket'),
        priority: z.union([z.number(), z.null()]).describe('The priority of the ticket'),
        // labels: z.union([z.array(z.object({
        //     id: z.string().describe('The label ID'),
        //     name: z.string().describe('The label name'),
        //     color: z.string().describe('The label color')
        // })), z.null()]).describe('The labels for the ticket'),
        estimate: z.union([z.number(), z.null()]).describe('The time estimate for the ticket'),
        dueDate: z.union([z.string(), z.null()]).describe('The due date for the ticket'),
        project: z.union([z.object({
            id: z.string().describe('The project ID'),
            name: z.string().describe('The project name')
        }), z.null()]).describe('The project for the ticket'),
    }),
    execute: async ({ id, title, description, state, assignee, priority, estimate, dueDate, project }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        const teamId = runContext.context.teamId;
        if (!teamId) {
            console.error(chalk.red.bold('❌ No team ID provided. Unable to update ticket.'));
            throw new Error("No team ID provided");
        }

        let ticketManager = runContext.context.ticketManager;

        console.log('Ticket Tool: Updated ticket');

        // get valid states for the ticket system
        const userContext: UserContext = await ticketManager.getUserContext();
        if (!userContext.ticketStates.some(s => s.id === state)) {
            console.error(chalk.red.bold('❌ Invalid state. This will fail!'));
            throw new Error("Invalid state. Please use a valid state from the user context.");
        }

        let ticket = await ticketManager.updateTicket(id, {
            title,
            description: description || undefined,
            state: {
                id: state,
                name: state
            },
            assignee: assignee?.email || undefined,
            priority: priority || undefined,
            project: project || undefined,
            teamId: teamId,
        });

        runContext?.context.trackChange(EntityType.TICKET, ticket.id, ChangeEventType.UPDATED);

        return ticket;
    }
});

const findIssueTool = tool({
    name: 'findIssueWithId',
    description: "find an issue/ticket in the user's ticket system",
    parameters: z.object({
        issueId: z.string().describe('The ID of the issue to find'),
    }),
    execute: async ({ issueId }: { issueId: string }, runContext?: RunContext<SessionWithTracking>) => {
        console.log(chalk.cyan('\nFetching issue with ID: ' + issueId));

        if (!runContext?.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        return await ticketManager.findTicket(issueId);
    },
});

const commentOnTicketTool = tool({
    name: 'commentOnTicket',
    description: "comment on a ticket",
    parameters: z.object({
        issueId: z.string().describe('The ID of the issue to comment on'),
        comment: z.string().describe('The comment to add to the ticket'),
    }),
    execute: async ({ issueId, comment }: { issueId: string, comment: string }, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        console.log(chalk.cyan('\nCommenting on ticket: ' + issueId));

        return await ticketManager.commentOnTicket(issueId, comment);
    },
});

export const ticketTools = [createTicketTool, updateTicketTool, findIssueTool, searchTicketTool, getCurrentUserTool, commentOnTicketTool];