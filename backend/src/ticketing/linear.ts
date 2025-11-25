import { SearchItem } from "../search/SearchItem";
import { CreateTicketInput, Ticket, TicketSystemType, TicketWebhookHandler, UpdateTicketInput, Project, CommitAssociation } from "../shared/TicketSystem";
import { Issue, IssuePayload, LinearClient, User as LinearUser, Project as LinearProject } from "@linear/sdk";
import chalk from "chalk";
import { StructuredSearchOptions, TicketManager } from "./TicketIntegration";
import { Team, User, UserContext, Organization } from "../shared/TicketSystem";
import { IssueFilter, IssuesQueryVariables } from "@linear/sdk/dist/_generated_documents";
import { generateWebhookSecret } from '../utility/webhookSecrets';
import { urls } from "../config/settings";

export class LinearAdapter implements TicketManager {
    type: TicketSystemType = TicketSystemType.Linear;

    private client: LinearClient;

    constructor(apiKey: string) {
        this.client = new LinearClient({ apiKey });
    }

    async getUserContext(): Promise<UserContext> {
        const viewer = await this.client.viewer;
        const organization = await this.client.organization;
        const teams = await viewer.teams();

        const user: User = {
            id: viewer.id,
            name: viewer.name,
            email: viewer.email,
        };

        const teamsList: Team[] = teams.nodes.map((team) => ({
            id: team.id,
            name: team.name,
            key: team.key,
        }));

        const projects = await this.client.projects();

        const org: Organization = {
            name: organization.name,
            createdAt: organization.createdAt.toISOString(),
            createdIssueCount: organization.createdIssueCount,
            userCount: organization.userCount,
            projects: projects.nodes.map((project) => ({
                id: project.id,
                name: project.name,
                description: project.description || undefined,
                updates: []
            })),
        };

        const ticketStates = await this.client.workflowStates();

        const milestones = await this.client.projectMilestones();

        return {
            userInfo: user,
            teams: teamsList,
            organization: org,
            ticketStates: ticketStates.nodes.map((state) => ({
                id: state.id,
                name: state.name,
            })),
            milestones: milestones.nodes.map((milestone) => ({
                id: milestone.id,
                name: milestone.name,
            })),
        };
    }

    async configureWebhook(): Promise<{ webhookId: string, webhookSecret: string } | null> {
        const user: LinearUser = await this.client.viewer;
        if (!user) {
            console.error(chalk.red('❌ No user found'));
            return null;
        }

        const webhookSecret = this.generateWebhookSecret();
        const backendUrl = urls.backend;

        const webhook = await this.client.createWebhook({
            url: `${backendUrl}/webhooks/linear/${user.id}`,
            secret: webhookSecret,
            allPublicTeams: true,
            resourceTypes: ['Issue', 'Comment', 'Project', 'IssueLabel', 'User']
        });

        if (!webhook.webhook || !webhook.webhookId) {
            console.error(chalk.red('❌ No webhook found'));
            return null;
        }

        console.log(chalk.green('✅ Webhook created:'), chalk.cyan(webhook.webhookId));

        return { webhookId: webhook.webhookId, webhookSecret: webhookSecret };
    }

    async tearDownWebhook(webhookId: string): Promise<void> {
        await this.client.deleteWebhook(webhookId);
        console.log(chalk.green('✅ Webhook deleted:'), chalk.cyan(webhookId));
    }

    generateWebhookSecret() {
        // Generate 32 random bytes and convert to hex
        // Using utility function for consistency
        return generateWebhookSecret(32);
    }

    async getAllTickets(): Promise<Ticket[]> {
        const tickets = await this.client.issues();
        return await Promise.all(tickets.nodes.map(async ticket => this.convertLinearTicket(ticket)));
    }

    async getAllProjects(): Promise<Project[]> {
        const projects = await this.client.projects();
        return Promise.all(projects.nodes.map(async project => ({
            id: project.id,
            name: project.name,
            description: project.description || undefined,
            updates: []
        })));
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

    async getTeams(): Promise<Team[]> {
        const teams = await this.client.teams();
        return teams.nodes.map(team => ({
            id: team.id,
            name: team.name,
            key: team.key
        }));
    }

    async me(): Promise<User | null> {
        const user: LinearUser = await this.client.viewer;
        if (!user) {
            console.error(chalk.red('❌ No user found'));
            return null;
        }
        return {
            id: user.id,
            name: user.name,
            email: user.email,
        };
    }

    async resolveUser(email: string): Promise<LinearUser | null> {
        const user = await this.client.users({
            filter: {
                email: {
                    eq: email
                }
            }
        });
        if (!user) {
            console.error(chalk.red('❌ No user found'));
            return null;
        }
        return user.nodes[0];
    }

    async structuredSearch(query: string, options?: StructuredSearchOptions): Promise<Ticket[]> {
        // Build comprehensive filter object
        const filter: IssueFilter = {}; // Pretend this is an IssueFilter

        // Text search across multiple fields
        if (query) {
            filter.or = [
                { title: { contains: query } },
                { description: { contains: query } },
            ];
        }

        // Team filtering
        if (options?.teamIds && options.teamIds.length > 0) {
            filter.team = { id: { in: options.teamIds } };
        }

        if (options?.assigneeEmails && options.assigneeEmails.length > 0) {
            if (options.assigneeEmails.length === 1) {
                const user = await this.resolveUser(options.assigneeEmails[0]);
                if (!user) {
                    console.error(chalk.red('❌ No user found'));
                    return [];
                }
                filter.assignee = { id: { eq: user.id } };
            } else {
                // Multiple assignees
                const users = await Promise.all(options.assigneeEmails.map(async email => {
                    const user = await this.resolveUser(email);
                    return user;
                }));
                filter.assignee = { id: { in: users.map(user => user?.id || '') } };
            }
        }

        if (options?.createdByEmails && options.createdByEmails.length > 0) {
            if (options.createdByEmails.length === 1) {
                const user = await this.resolveUser(options.createdByEmails[0]);
                if (!user) {
                    console.error(chalk.red('❌ No user found'));
                    return [];
                }
                filter.creator = { id: { eq: user.id } };
            } else {
                const users = await Promise.all(options.createdByEmails.map(async email => {
                    const user = await this.resolveUser(email);
                    return user;
                }));
                filter.creator = { id: { in: users.map(user => user?.id || '') } };
            }
        }

        // State filtering
        if (options?.stateIds && options.stateIds.length > 0) {
            filter.state = { id: { in: options.stateIds } };
        }

        // Priority filtering
        if (options?.priority && options.priority.length > 0) {
            filter.priority = { in: options.priority };
        }

        // Label filtering
        if (options?.labels && options.labels.length > 0) {
            filter.labels = { name: { in: options.labels } };
        }

        // Project filtering
        if (options?.projects && options.projects.length > 0) {
            filter.project = { id: { in: options.projects } };
        }

        // Due date range filtering
        if (options?.dueDateRange) {
            filter.dueDate = {};
            if (options.dueDateRange.from) {
                filter.dueDate.gte = options.dueDateRange.from;
            }
            if (options.dueDateRange.to) {
                filter.dueDate.lte = options.dueDateRange.to;
            }
        }

        // Created date range filtering
        if (options?.createdDateRange) {
            filter.createdAt = {};
            if (options.createdDateRange.from) {
                filter.createdAt.gte = options.createdDateRange.from;
            }
            if (options.createdDateRange.to) {
                filter.createdAt.lte = options.createdDateRange.to;
            }
        }

        // Updated date range filtering
        if (options?.updatedDateRange) {
            filter.updatedAt = {};
            if (options.updatedDateRange.from) {
                filter.updatedAt.gte = options.updatedDateRange.from;
            }
            if (options.updatedDateRange.to) {
                filter.updatedAt.lte = options.updatedDateRange.to;
            }
        }

        // Archive filtering
        if (options?.includeArchived === false) {
            filter.archivedAt = { eq: null };
        }

        // Sub-issues filtering
        if (options?.includeSubIssues === false) {
            filter.parent = { id: { eq: null } };
        }

        // Build sort options
        let sortOptions: any = options?.sortBy == 'updatedAt' ? 'updatedAt' : 'createdAt'

        let issues;
        try {
            // Execute the query with comprehensive options
            const params: IssuesQueryVariables = {
                filter,
                orderBy: sortOptions,
                first: options?.limit || 50, // Default limit of 50
                includeArchived: options?.includeArchived || false,
            }
            issues = await this.client.issues(params);
        } catch (error) {
            console.error('Failed to search issues', error);
            throw new Error('Failed to search issues');
        }

        console.log(chalk.green('✅ Found'), chalk.cyan(issues.nodes.length), chalk.yellow('issues'));

        // Fetch detailed information for each issue
        const tickets = await Promise.all(issues.nodes.map(async issue => {
            const ticket = await this.findTicket(issue.id);

            // Optionally include additional data
            if (options?.includeComments) {
                const comments = await issue.comments();
                // You could extend the Ticket interface to include comments
                // For now, we'll just fetch them but not include in the return
            }

            if (options?.includeAttachments) {
                const attachments = await issue.attachments();
                // Similar to comments, could extend interface
            }

            if (options?.includeRelations) {
                const relations = await issue.relations();
                // Could extend interface to include related issues
            }

            return ticket;
        }));

        return tickets;
    }

    async isTicketComplete(ticketId: string): Promise<boolean> {
        const ticket = await this.findTicket(ticketId);
        return ticket.state.name === 'Done';
    }

    async associateCommitsToTicket(ticketId: string, commits: CommitAssociation[], branchName: string): Promise<void> {
        const issue = await this.client.issue(ticketId);
        if (!issue) {
            throw new Error(`Issue ${ticketId} not found`);
        }

        // Get existing comments to avoid duplicates
        const comments = await issue.comments();
        
        for (const commit of commits) {
            // Check if commit is already mentioned in comments
            const existing = comments.nodes.find(c => c.body.includes(commit.sha.substring(0, 8)));
            if (existing) {
                console.log(`Commit ${commit.sha} already associated with ${ticketId}`);
                continue;
            }

            // Create comment for the commit
            const comment = `🔗 **Commit**: ${commit.sha.substring(0, 8)}\n` +
                           `📝 **Message**: ${commit.message}\n` +
                           `🌿 **Branch**: ${commit.branch || 'main'}\n` +
                           `📦 **Repository**: ${commit.repository}\n` +
                           `🔗 **Link**: ${commit.url}`;
            
            await this.client.createComment({
                body: comment,
                issueId: ticketId
            });
            
            console.log(`✅ Associated commit ${commit.sha} with ${ticketId}`);
        }
    }

    async findTicket(id: string): Promise<Ticket> {
        console.log(chalk.green('✅ Finding ticket:'), chalk.cyan(id));
        const issue = await this.client.issue(id);
        if (!issue) {
            throw new Error('Issue not found');
        }

        return this.convertLinearTicket(issue);
    }

    async getTickets(ids: string[]): Promise<Ticket[]> {
        const issues = await this.client.issues({
            filter: { id: { in: ids } }
        });
        return await Promise.all(issues.nodes.map(async issue => this.convertLinearTicket(issue)));
    }

    async userIdFromEmail(email: string): Promise<string | null> {
        const user = await this.client.users({
            filter: {
                email: { eq: email }
            }
        });
        if (!user) {
            return null;
        }
        return user.nodes[0].id;
    }

    async createTicket(input: CreateTicketInput): Promise<Ticket> {
        console.log('Creating ticket', input);
        console.log('Assignee email', input.assignee);
        console.log('Assignee id', await this.userIdFromEmail(input.assignee || ''));
        let issuePayload;
        try {
            issuePayload = await this.client.createIssue({
                title: input.title,
                description: input.description,
                teamId: input.teamId,
                stateId: input.state?.id || undefined,
                assigneeId: await this.userIdFromEmail(input.assignee || ''),
                projectId: input.project?.id || undefined,
                projectMilestoneId: input.milestone?.id || undefined,
            });
        } catch (error) {
            console.error('Failed to create issue', error);
            throw new Error('Failed to create issue');
        }

        let newIssue = await issuePayload.issue;
        if (!newIssue) {
            console.error('Failed to create issue', issuePayload);
            throw new Error('Failed to create issue');
        }

        console.log(chalk.green('✅ New issue created:'), chalk.cyan(newIssue.title), chalk.yellow(`(${newIssue.id})`));

        return this.convertLinearTicket(newIssue);
    }

    async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
        const issuePayload: IssuePayload = await this.client.updateIssue(id, {
            title: input.title,
            description: input.description,
            stateId: input.state?.id || undefined,
            assigneeId: await this.userIdFromEmail(input.assignee || ''),
            projectMilestoneId: input.milestone?.id || undefined,
        });

        let updatedIssue = await issuePayload.issue;
        if (!updatedIssue) {
            throw new Error('Failed to update issue');
        }

        return this.convertLinearTicket(updatedIssue);
    }

    async commentOnTicket(id: string, comment: string): Promise<void> {
        const issue = await this.client.issue(id);
        if (!issue) {
            throw new Error('Issue not found');
        }

        const newComment = await this.client.createComment({
            body: comment,
            issueId: id
        });

        console.log(chalk.green('✅ Comment added:'), chalk.cyan(newComment.comment));
    }

    async deleteComment(ticketId: string, commentId: string): Promise<void> {
        this.client.deleteComment(commentId);
    }

    async searchItemsForTicket(id: string): Promise<SearchItem[]> {
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
            entityType: 'ticket',
            entityId: issue.id,
            content: issue.description || '',
            metadata: {}
        }
        ]
    }

    async searchItemsForProject(id: string): Promise<SearchItem[]> {
        const project: LinearProject = await this.client.project(id);
        if (!project) {
            throw new Error('Project not found');
        }

        let teams = await project.teams();
        if (!teams) {
            throw new Error('Team not found');
        }
        /// This may be an issue but it seems projects can span multiple teams.
        return [{
            id: project.id,
            teamId: teams.nodes[0]?.id || '',
            entityType: 'project',
            entityId: project.id,
            content: project.name,
            metadata: {}
        }]
    }

    // Additional utility methods for comprehensive Linear API access
    async getTeam(teamId: string): Promise<{ id: string; name: string; key: string; description?: string } | null> {
        try {
            const team = await this.client.team(teamId);
            if (!team) return null;

            return {
                id: team.id,
                name: team.name,
                key: team.key,
                description: team.description || undefined
            };
        } catch (error) {
            console.error('Error fetching team:', error);
            return null;
        }
    }

    async getStates(teamId?: string): Promise<Array<{ id: string; name: string; type: string; color: string; teamId: string }>> {
        const states = teamId
            ? await this.client.team(teamId).then(team => team?.states())
            : await this.client.workflowStates();

        if (!states) return [];

        const statesWithTeams = await Promise.all(states.nodes.map(async state => {
            const team = await state.team;
            return {
                id: state.id,
                name: state.name,
                type: state.type,
                color: state.color,
                teamId: team?.id || ''
            };
        }));

        return statesWithTeams;
    }

    async getLabels(teamId?: string): Promise<Array<{ id: string; name: string; color: string; teamId: string }>> {
        const labels = teamId
            ? await this.client.team(teamId).then(team => team?.labels())
            : await this.client.issueLabels();

        if (!labels) return [];

        const labelsWithTeams = await Promise.all(labels.nodes.map(async label => {
            const team = await label.team;
            return {
                id: label.id,
                name: label.name,
                color: label.color,
                teamId: team?.id || ''
            };
        }));

        return labelsWithTeams;
    }

    async getProjects(teamId?: string): Promise<Array<{ id: string; name: string; description?: string; teamId: string }>> {
        const projects = teamId
            ? await this.client.team(teamId).then(team => team?.projects())
            : await this.client.projects();

        if (!projects) return [];

        const projectsWithTeams = await Promise.all(projects.nodes.map(async project => {
            const teams = await project.teams();
            const teamId = teams.nodes[0]?.id || '';
            return {
                id: project.id,
                name: project.name,
                description: project.description || undefined,
                teamId
            };
        }));

        return projectsWithTeams;
    }

    async getUsers(): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string }>> {
        const users = await this.client.users();
        return users.nodes.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl || undefined
        }));
    }

    async getUser(userId: string): Promise<{ id: string; name: string; email: string; avatarUrl?: string } | null> {
        try {
            const user = await this.client.user(userId);
            if (!user) return null;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl || undefined
            };
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }

    async getCurrentUser(): Promise<{ id: string; name: string; email: string; avatarUrl?: string } | null> {
        try {
            const user = await this.client.viewer;
            if (!user) return null;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl || undefined
            };
        } catch (error) {
            console.error('Error fetching current user:', error);
            return null;
        }
    }

    async getIssueComments(issueId: string): Promise<Array<{ id: string; body: string; authorId: string; createdAt: string }>> {
        const issue = await this.client.issue(issueId);
        if (!issue) throw new Error('Issue not found');

        const comments = await issue.comments();
        const commentsWithUsers = await Promise.all(comments.nodes.map(async comment => {
            const user = await comment.user;
            return {
                id: comment.id,
                body: comment.body,
                authorId: user?.id || '',
                createdAt: comment.createdAt.toISOString()
            };
        }));

        return commentsWithUsers;
    }

    async getIssueAttachments(issueId: string): Promise<Array<{ id: string; title: string; url: string; createdAt: string }>> {
        const issue = await this.client.issue(issueId);
        if (!issue) throw new Error('Issue not found');

        const attachments = await issue.attachments();
        return attachments.nodes.map(attachment => ({
            id: attachment.id,
            title: attachment.title,
            url: attachment.url,
            createdAt: attachment.createdAt.toISOString()
        }));
    }

    async getIssueRelations(issueId: string): Promise<Array<{ id: string; type: string; relatedIssueId: string }>> {
        const issue = await this.client.issue(issueId);
        if (!issue) throw new Error('Issue not found');

        const relations = await issue.relations();
        const relationsWithIssues = await Promise.all(relations.nodes.map(async relation => {
            const relatedIssue = await relation.relatedIssue;
            return {
                id: relation.id,
                type: relation.type,
                relatedIssueId: relatedIssue?.id || ''
            };
        }));

        return relationsWithIssues;
    }

    // helper
    private async convertLinearTicket(issue: Issue): Promise<Ticket> {
        // Construct Linear URL: https://linear.app/{organizationSlug}/issue/{identifier}
        // Linear SDK Issue doesn't expose URL directly, so we construct it
        let url: string | undefined;
        try {
            const organization = await this.client.organization;
            // Organization has a urlKey property that is the slug
            const orgSlug = (organization as any).urlKey || organization.name?.toLowerCase().replace(/\s+/g, '-');
            if (orgSlug && issue.identifier) {
                url = `https://linear.app/${orgSlug}/issue/${issue.identifier}`;
            }
        } catch (error) {
            // If we can't get organization, URL will be undefined
            console.warn('Could not construct Linear ticket URL:', error);
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
            updatedAt: issue.updatedAt.toISOString(),
            url: url,
        }
    }
}