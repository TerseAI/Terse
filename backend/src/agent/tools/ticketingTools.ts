import { RunContext, tool } from "@openai/agents";
import { Session } from "../../server";
import { z } from "zod";
import chalk from "chalk";


const createTicketTool = tool({
    name: 'Create Ticket',
    description: 'Create a new ticket',
    parameters: z.object({
        title: z.string().describe('The title of the ticket'),
        description: z.string().optional().describe('The description of the ticket'),
        state: z.object({
            id: z.string().describe('The state ID of the ticket'),
            name: z.string().describe('The state name of the ticket')
        }).describe('The state of the ticket'),
        assignee: z.object({
            id: z.string().describe('The assignee ID'),
            name: z.string().describe('The assignee name')
        }).optional().describe('The assignee of the ticket'),
        priority: z.number().optional().describe('The priority of the ticket'),
        labels: z.array(z.object({
            id: z.string().describe('The label ID'),
            name: z.string().describe('The label name'),
            color: z.string().describe('The label color')
        })).optional().describe('The labels for the ticket'),
        estimate: z.number().optional().describe('The time estimate for the ticket'),
        dueDate: z.string().optional().describe('The due date for the ticket'),
        project: z.object({
            id: z.string().describe('The project ID'),
            name: z.string().describe('The project name')
        }).optional().describe('The project for the ticket'),
        team: z.object({
            id: z.string().describe('The team ID'),
            name: z.string().describe('The team name'),
            key: z.string().describe('The team key')
        }).optional().describe('The team for the ticket'),
    }),
    execute: async ({ title, description, state, assignee, priority, labels, estimate, dueDate, project, team }, runContext?: RunContext<Session>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }
        
        let ticketManager = runContext.context.ticketManager;

        let ticket = await ticketManager.createTicket({
            title,
            description,
            state,
            assignee,
            priority,
            labels,
            estimate,
            dueDate,
            project,
            team,
        });

        console.log('Ticket Tool: Created ticket');

        return ticket;
    }
});

const updateTicketTool = tool({
    name: 'Update Ticket',
    description: 'Update an existing ticket',
    parameters: z.object({
        id: z.string().describe('The ID of the ticket'),
        title: z.string().describe('The title of the ticket'),
        description: z.string().optional().describe('The description of the ticket'),
        state: z.object({
            id: z.string().describe('The state ID of the ticket'),
            name: z.string().describe('The state name of the ticket')
        }).describe('The state of the ticket'),
        assignee: z.object({
            id: z.string().describe('The assignee ID'),
            name: z.string().describe('The assignee name')
        }).optional().describe('The assignee of the ticket'),
        priority: z.number().optional().describe('The priority of the ticket'),
        labels: z.array(z.object({
            id: z.string().describe('The label ID'),
            name: z.string().describe('The label name'),
            color: z.string().describe('The label color')
        })).optional().describe('The labels for the ticket'),
        estimate: z.number().optional().describe('The time estimate for the ticket'),
        dueDate: z.string().optional().describe('The due date for the ticket'),
        project: z.object({
            id: z.string().describe('The project ID'),
            name: z.string().describe('The project name')
        }).optional().describe('The project for the ticket'),
        team: z.object({
            id: z.string().describe('The team ID'),
            name: z.string().describe('The team name'),
            key: z.string().describe('The team key')
        }).optional().describe('The team for the ticket'),
    }),
    execute: async ({ id, title, description, state, assignee, priority, labels, estimate, dueDate, project, team }, runContext?: RunContext<Session>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!runContext.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        let ticket = await ticketManager.updateTicket(id, {
            title,
            description,
            state,
            assignee,
            priority,
            labels,
            estimate,
            dueDate,
            project,
            team,
        });

        console.log('Ticket Tool: Created ticket');

        return ticket;
    }
});

const findIssueTool = tool({
    name: 'findIssueWithId',
    description: "find an issue/ticket in the user's ticket system",
    parameters: z.object({
        issueId: z.string().describe('The ID of the issue to find'),
    }),
    execute: async ({ issueId }: { issueId: string }, runContext?: RunContext<Session>) => {
        console.log(chalk.cyan('\nFetching issue with ID: ' + issueId));

        if (!runContext?.context.ticketManager) {
            throw new Error("No ticket manager provided");
        }

        let ticketManager = runContext.context.ticketManager;

        return await ticketManager.findTicket(issueId);
    },
});

export const ticketTools = [createTicketTool, updateTicketTool, findIssueTool];