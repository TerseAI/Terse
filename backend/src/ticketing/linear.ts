import { SearchItem } from "src/search/SearchItem";
import { CreateTicketInput, Ticket, TicketSystemType, TicketWebhookHandler, UpdateTicketInput } from "../shared/TicketSystem";
import { IssuePayload, LinearClient } from "@linear/sdk";
import chalk from "chalk";
import { TicketIntegration } from "./TicketIntegration";

export class LinearAdapter implements TicketIntegration {
    type: TicketSystemType = TicketSystemType.Linear;

    private client: LinearClient;

    constructor(apiKey: string) {
        this.client = new LinearClient({ apiKey });
    }

    static async validateKey(apiKey: string): Promise<boolean> {
        try {
            const client = new LinearClient({ apiKey });
            const user = await client.viewer;
            return user !== null;
        } catch (error) {
            console.error(chalk.red('Error validating Linear API key:'), error);
            return false;
        }
    }

    async findTicket(id: string): Promise<Ticket> {
        const issue = await this.client.issue(id);
        if (!issue) {
            throw new Error('Issue not found');
        }

        return {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description || undefined,
            state: {
                id: (await issue.state)?.id || '',
                name: (await issue.state)?.name || 'Unknown'
            },
            assignee: issue.assignee ? {
                id: (await issue.assignee)?.id || '',
                name: (await issue.assignee)?.name || 'Unknown'
            } : null,
            priority: issue.priority || undefined,
            estimate: issue.estimate || undefined,
            dueDate: issue.dueDate instanceof Date ? issue.dueDate.toISOString() : issue.dueDate || undefined,
            project: issue.project ? {
                id: (await issue.project)?.id || '',
                name: (await issue.project)?.name || 'Unknown'
            } : null,
            team: {
                id: (await issue.team)?.id || '',
                name: (await issue.team)?.name || 'Unknown',
                key: (await issue.team)?.key || ''
            },
            createdAt: issue.createdAt.toISOString(),
            updatedAt: issue.updatedAt.toISOString()
        }
    }

    async createTicket(input: CreateTicketInput): Promise<Ticket> {
        const issuePayload = await this.client.createIssue({
            title: input.title,
            description: input.description,
            teamId: input.teamId,
        });

        let newIssue = await issuePayload.issue;
        if (!newIssue) {
            throw new Error('Failed to create issue');
        }

        return {
            id: newIssue.id,
            identifier: newIssue.identifier,
            title: newIssue.title,
            description: newIssue.description || undefined,
            state: {
                id: (await newIssue.state)?.id || '',
                name: (await newIssue.state)?.name || 'Unknown'
            },
            assignee: newIssue.assignee ? {
                id: (await newIssue.assignee)?.id || '',
                name: (await newIssue.assignee)?.name || 'Unknown'
            } : null,
            priority: newIssue.priority || undefined,
            estimate: newIssue.estimate || undefined,
            dueDate: newIssue.dueDate instanceof Date ? newIssue.dueDate.toISOString() : newIssue.dueDate || undefined,
            project: newIssue.project ? {
                id: (await newIssue.project)?.id || '',
                name: (await newIssue.project)?.name || 'Unknown'
            } : null,
            team: {
                id: (await newIssue.team)?.id || '',
                name: (await newIssue.team)?.name || 'Unknown',
                key: (await newIssue.team)?.key || ''
            },
            createdAt: newIssue.createdAt.toISOString(),
            updatedAt: newIssue.updatedAt.toISOString()
        }
    }

    async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
        const issuePayload: IssuePayload = await this.client.updateIssue(id, {
            title: input.title,
            description: input.description,
        });

        let updatedIssue = await issuePayload.issue;
        if (!updatedIssue) {
            throw new Error('Failed to update issue');
        }

        return {
            id: updatedIssue.id,
            identifier: updatedIssue.identifier,
            title: updatedIssue.title,
            description: updatedIssue.description || undefined,
            state: {
                id: (await updatedIssue.state)?.id || '',
                name: (await updatedIssue.state)?.name || 'Unknown'
            },
            assignee: updatedIssue.assignee ? {
                id: (await updatedIssue.assignee)?.id || '',
                name: (await updatedIssue.assignee)?.name || 'Unknown'
            } : null,
            priority: updatedIssue.priority || undefined,
            estimate: updatedIssue.estimate || undefined,
            dueDate: updatedIssue.dueDate instanceof Date ? updatedIssue.dueDate.toISOString() : updatedIssue.dueDate || undefined,
            project: updatedIssue.project ? {
                id: (await updatedIssue.project)?.id || '',
                name: (await updatedIssue.project)?.name || 'Unknown'
            } : null,
            team: {
                id: (await updatedIssue.team)?.id || '',
                name: (await updatedIssue.team)?.name || 'Unknown',
                key: (await updatedIssue.team)?.key || ''
            },
            createdAt: updatedIssue.createdAt.toISOString(),
            updatedAt: updatedIssue.updatedAt.toISOString()
        }
    }

    async deleteComment(ticketId: string, commentId: string): Promise<void> {
        this.client.deleteComment(commentId);
    }

    onNewTicket(handler: TicketWebhookHandler): void {
        throw new Error("Method not implemented.");
    }

    async indexTicket(id: string): Promise<SearchItem[]> {
        const issue = await this.client.issue(id);
        if (!issue) {
            throw new Error('Issue not found');
        }

        let team = await issue.team;
        if (!team) {
            throw new Error('Team not found');
        }

        return [{
            id: issue.id,
            teamId: team.id,
            entityType: 'ticket',
            entityId: issue.id,
            content: issue.title,
            metadata: {}
        },
        {
            id: issue.id,
            teamId: team.id,
            entityType: 'description',
            entityId: issue.id,
            content: issue.description || '',
            metadata: {}
        }
    ]
    }
}