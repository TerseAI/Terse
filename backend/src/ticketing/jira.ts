import JiraClient from 'jira-client';
import { SearchItem } from '../search/SearchItem';
import { CreateTicketInput, Ticket, TicketSystemType, UpdateTicketInput, User, UserContext, Team, Project } from '../shared/TicketSystem';
import { StructuredSearchOptions, TicketManager } from './TicketIntegration';
import chalk from 'chalk';

export class JiraAdapter implements TicketManager {
    type: TicketSystemType = TicketSystemType.Jira;

    private client: JiraClient;

    constructor(options: { baseUrl: string; email: string; apiToken: string }) {
        this.client = new JiraClient({
            host: options.baseUrl.replace(/^https?:\/\//, ''),
            protocol: options.baseUrl.startsWith('https') ? 'https' : 'http',
            username: options.email,
            password: options.apiToken,
            apiVersion: '3'
        });
    }

    static async validateCredentials(baseUrl: string, email: string, apiToken: string): Promise<boolean> {
        try {
            const client = new JiraClient({
                host: baseUrl.replace(/^https?:\/\//, ''),
                protocol: baseUrl.startsWith('https') ? 'https' : 'http',
                username: email,
                password: apiToken,
                apiVersion: '3'
            });
            await client.getCurrentUser();
            return true;
        } catch (error) {
            console.error(chalk.red("Invalid Jira credentials"), chalk.yellow(baseUrl), chalk.yellow(email), chalk.yellow(apiToken));
            console.error(error);
            return false;
        }
    }

    async getUserContext(): Promise<UserContext> {
        const me = await this.client.getCurrentUser();
        const projects = await this.client.listProjects();

        const user: User = {
            id: me.accountId,
            name: me.displayName,
            email: me.emailAddress
        };

        const teams: Team[] = projects.map((p: any) => ({ id: p.id, name: p.name, key: p.key }));

        return {
            userInfo: user,
            teams,
            organization: { name: '', createdAt: '', createdIssueCount: 0, userCount: 0, projects: [] },
            ticketStates: []
        };
    }

    async findTicket(id: string): Promise<Ticket> {
        const issue = await this.client.findIssue(id);
        return this.convertIssue(issue);
    }

    async getTickets(ids: string[]): Promise<Ticket[]> {
        const issues = await this.client.searchJira(`id in (${ids.join(',')})`);
        return issues.issues.map((i: any) => this.convertIssue(i));
    }

    async structuredSearch(jql: string, _options?: StructuredSearchOptions): Promise<Ticket[]> {
        const res = await this.client.searchJira(jql);
        return res.issues.map((i: any) => this.convertIssue(i));
    }

    async userIdFromEmail(email: string): Promise<string | null> {
        const users = await this.client.searchUsers({
            query: email
        });
        return users.length > 0 ? users[0].accountId : null;
    }

    async createTicket(input: CreateTicketInput): Promise<Ticket> {
        const issue = await this.client.addNewIssue({
            fields: {
                summary: input.title,
                description: input.description,
                project: { id: input.teamId },
                issuetype: { name: 'Task' },
                assignee: input.assignee ? { id: await this.userIdFromEmail(input.assignee) } : undefined
            }
        });
        return this.findTicket(issue.key);
    }

    async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
        const updateFields: any = {
            summary: input.title,
            description: input.description,
        };

        if (input.assignee) {
            updateFields.assignee = { id: await this.userIdFromEmail(input.assignee) };
        }

        if (input.state) {
            updateFields.status = { id: input.state };
        }

        await this.client.updateIssue(id, {
            fields: updateFields
        });
        return this.findTicket(id);
    }

    async commentOnTicket(id: string, comment: string): Promise<void> {
        await this.client.addComment(id, comment);
        console.log(chalk.green('✅ Comment added:'), chalk.cyan(comment));
    }

    async deleteComment(ticketId: string, commentId: string): Promise<void> {
        await this.client.deleteComment(ticketId, parseInt(commentId));
    }

    async searchItemsForTicket(id: string): Promise<SearchItem[]> {
        const issue = await this.client.findIssue(id);
        return [
            {
                id: issue.id,
                teamId: issue.fields.project.id,
                entityType: 'ticket',
                entityId: issue.id,
                content: issue.fields.summary,
                metadata: {}
            },
            {
                id: `${issue.id}-desc`,
                teamId: issue.fields.project.id,
                entityType: 'ticket',
                entityId: issue.id,
                content: issue.fields.description || '',
                metadata: {}
            }
        ];
    }

    async searchItemsForProject(id: string): Promise<SearchItem[]> {
        return [];
    }

    async getTeams(): Promise<Team[]> {
        const projects = await this.client.listProjects();
        return projects.map((p: any) => ({ id: p.id, name: p.name, key: p.key }));
    }

    async me(): Promise<User | null> {
        const me = await this.client.getCurrentUser();
        return me ? { id: me.accountId, name: me.displayName, email: me.emailAddress } : null;
    }

    async getAllTickets(): Promise<Ticket[]> {
        const res = await this.client.searchJira('');
        return res.issues.map((i: any) => this.convertIssue(i));
    }

    async getAllProjects(): Promise<Project[]> {
        const projects = await this.client.listProjects();
        return projects.map((p: any) => ({ id: p.id, name: p.name, description: p.description, teamId: p.lead.accountId }));
    }

    async configureWebhook(): Promise<{ webhookId: string; webhookSecret: string } | null> {
        return null; // Webhooks not implemented
    }

    private convertIssue(issue: any): Ticket {
        return {
            id: issue.id,
            identifier: issue.key,
            title: issue.fields.summary,
            description: issue.fields.description || undefined,
            state: {
                id: issue.fields.status?.id || '',
                name: issue.fields.status?.name || ''
            },
            assignee: issue.fields.assignee
                ? { id: issue.fields.assignee.accountId, name: issue.fields.assignee.displayName }
                : null,
            priority: issue.fields.priority ? parseInt(issue.fields.priority.id) : undefined,
            labels: (issue.fields.labels || []).map((l: string) => ({ id: l, name: l, color: '' })),
            estimate: issue.fields.timeoriginalestimate || undefined,
            dueDate: issue.fields.duedate || undefined,
            project: {
                id: issue.fields.project.id,
                name: issue.fields.project.name
            },
            team: { id: issue.fields.project.id, name: issue.fields.project.name, key: issue.fields.project.key },
            createdAt: issue.fields.created,
            updatedAt: issue.fields.updated
        };
    }
}

