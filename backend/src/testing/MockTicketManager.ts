import { 
    Ticket, 
    TicketSystemType, 
    CreateTicketInput, 
    UpdateTicketInput, 
    User, 
    UserContext, 
    Project, 
    CommitAssociation,
    Team,
    Organization,
    TicketState,
    Milestone
} from "../shared/TicketSystem";
import { SearchItem } from "../search/SearchItem";
import { StructuredSearchOptions, TicketManager } from "../ticketing/TicketIntegration";

export class MockTicketManager implements TicketManager {
    type: TicketSystemType = TicketSystemType.Linear; // Default to Linear, can be changed

    private mockTickets: Map<string, Ticket> = new Map();
    private mockUsers: Map<string, User> = new Map();
    private mockTeams: Map<string, Team> = new Map();
    private mockProjects: Map<string, Project> = new Map();
    private mockStates: Map<string, TicketState> = new Map();
    private mockMilestones: Map<string, Milestone> = new Map();
    private mockComments: Map<string, Array<{ id: string; authorId: string; body: string; createdAt: string }>> = new Map();
    private mockSearchItems: Map<string, SearchItem[]> = new Map();
    private mockCommits: Map<string, CommitAssociation[]> = new Map();

    constructor() {
        this.initializeDefaultData();
    }

    /**
     * Initialize the mock manager with test data
     */
    initializeWithData(data: {
        tickets?: Ticket[];
        users?: User[];
        teams?: Team[];
        projects?: Project[];
        states?: TicketState[];
        milestones?: Milestone[];
        type?: TicketSystemType;
    }) {
        if (data.type) {
            this.type = data.type;
        }

        if (data.tickets) {
            this.mockTickets.clear();
            data.tickets.forEach(ticket => this.mockTickets.set(ticket.identifier, ticket));
        }

        if (data.users) {
            this.mockUsers.clear();
            data.users.forEach(user => this.mockUsers.set(user.id, user));
        }

        if (data.teams) {
            this.mockTeams.clear();
            data.teams.forEach(team => this.mockTeams.set(team.id, team));
        }

        if (data.projects) {
            this.mockProjects.clear();
            data.projects.forEach(project => this.mockProjects.set(project.id, project));
        }

        if (data.states) {
            this.mockStates.clear();
            data.states.forEach(state => this.mockStates.set(state.id, state));
        }

        if (data.milestones) {
            this.mockMilestones.clear();
            data.milestones.forEach(milestone => this.mockMilestones.set(milestone.id, milestone));
        }
    }

    /**
     * Add a single ticket to the mock manager
     */
    addTicket(ticket: Ticket) {
        this.mockTickets.set(ticket.id, ticket);
    }

    /**
     * Add a single user to the mock manager
     */
    addUser(user: User) {
        this.mockUsers.set(user.id, user);
    }

    /**
     * Add a single team to the mock manager
     */
    addTeam(team: Team) {
        this.mockTeams.set(team.id, team);
    }

    /**
     * Add a single project to the mock manager
     */
    addProject(project: Project) {
        this.mockProjects.set(project.id, project);
    }

    /**
     * Add a single state to the mock manager
     */
    addState(state: TicketState) {
        this.mockStates.set(state.id, state);
    }

    /**
     * Add a single milestone to the mock manager
     */
    addMilestone(milestone: Milestone) {
        this.mockMilestones.set(milestone.id, milestone);
    }

    /**
     * Add a comment to a ticket
     */
    addComment(ticketId: string, comment: { id: string; authorId: string; body: string; createdAt: string }) {
        if (!this.mockComments.has(ticketId)) {
            this.mockComments.set(ticketId, []);
        }
        this.mockComments.get(ticketId)!.push(comment);
    }

    /**
     * Add commit associations to a ticket
     */
    addCommits(ticketId: string, commits: CommitAssociation[]) {
        this.mockCommits.set(ticketId, commits);
    }

    /**
     * Add search items for a ticket
     */
    addSearchItems(ticketId: string, searchItems: SearchItem[]) {
        this.mockSearchItems.set(ticketId, searchItems);
    }

    // Implementation of TicketManager interface

    async getUserContext(): Promise<UserContext> {
        const defaultUser = Array.from(this.mockUsers.values())[0] || this.createDefaultUser();
        const teams = Array.from(this.mockTeams.values());
        const projects = Array.from(this.mockProjects.values());
        const states = Array.from(this.mockStates.values());
        const milestones = Array.from(this.mockMilestones.values());

        const org: Organization = {
            name: 'Mock Organization',
            createdAt: new Date().toISOString(),
            createdIssueCount: this.mockTickets.size,
            userCount: this.mockUsers.size,
            projects: projects
        };

        return {
            userInfo: defaultUser,
            teams: teams,
            organization: org,
            ticketStates: states,
            milestones: milestones
        };
    }

    async findTicket(id: string): Promise<Ticket> {
        const ticket = this.mockTickets.get(id);
        if (!ticket) {
            throw new Error(`Ticket with id ${id} not found`);
        }
        return ticket;
    }

    async getTickets(ids: string[]): Promise<Ticket[]> {
        const tickets: Ticket[] = [];
        for (const id of ids) {
            const ticket = this.mockTickets.get(id);
            if (ticket) {
                tickets.push(ticket);
            }
        }
        return tickets;
    }

    async structuredSearch(query: string, options?: StructuredSearchOptions): Promise<Ticket[]> {
        let results = Array.from(this.mockTickets.values());

        // Apply filters based on options
        if (options?.teamIds && options.teamIds.length > 0) {
            results = results.filter(ticket => ticket.team && options.teamIds!.includes(ticket.team.id));
        }

        if (options?.assigneeEmails && options.assigneeEmails.length > 0) {
            results = results.filter(ticket => 
                ticket.assignee && options.assigneeEmails!.includes(ticket.assignee.name)
            );
        }

        if (options?.stateIds && options.stateIds.length > 0) {
            results = results.filter(ticket => options.stateIds!.includes(ticket.state.id));
        }

        if (options?.priority && options.priority.length > 0) {
            results = results.filter(ticket => 
                ticket.priority && options.priority!.includes(ticket.priority)
            );
        }

        if (options?.projects && options.projects.length > 0) {
            results = results.filter(ticket => 
                ticket.project && options.projects!.includes(ticket.project.id)
            );
        }

        if (options?.labels && options.labels.length > 0) {
            results = results.filter(ticket => 
                ticket.labels && ticket.labels.some(label => options.labels!.includes(label.name))
            );
        }

        // Apply limit
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }

        return results;
    }

    async createTicket(input: CreateTicketInput): Promise<Ticket> {
        // Find the team by teamId
        const team = Array.from(this.mockTeams.values()).find(t => t.id === input.teamId);
        if (!team) {
            throw new Error(`Team with id ${input.teamId} not found`);
        }

        // Find assignee user if assignee email is provided
        let assignee = null;
        if (input.assignee) {
            assignee = Array.from(this.mockUsers.values()).find(u => u.email === input.assignee);
        }

        const newTicket: Ticket = {
            id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            identifier: `TICKET-${Date.now()}`,
            title: input.title,
            description: input.description,
            state: input.state || { id: 'default-state', name: 'To Do' },
            assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
            priority: input.priority,
            labels: [],
            estimate: undefined,
            dueDate: undefined,
            project: input.project || null,
            team: team,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.mockTickets.set(newTicket.id, newTicket);
        return newTicket;
    }

    async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
        const existingTicket = this.mockTickets.get(id);
        if (!existingTicket) {
            throw new Error(`Ticket with id ${id} not found`);
        }

        // Handle assignee update - convert email to user object
        let assignee = existingTicket.assignee;
        if (input.assignee) {
            const assigneeUser = Array.from(this.mockUsers.values()).find(u => u.email === input.assignee);
            assignee = assigneeUser ? { id: assigneeUser.id, name: assigneeUser.name } : null;
        }

        const updatedTicket: Ticket = {
            ...existingTicket,
            title: input.title,
            description: input.description,
            state: input.state || existingTicket.state,
            assignee: assignee,
            priority: input.priority,
            project: input.project,
            updatedAt: new Date().toISOString()
        };

        this.mockTickets.set(id, updatedTicket);
        return updatedTicket;
    }

    async commentOnTicket(id: string, comment: string): Promise<void> {
        if (!this.mockTickets.has(id)) {
            throw new Error(`Ticket with id ${id} not found`);
        }

        const newComment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            authorId: 'mock-user',
            body: comment,
            createdAt: new Date().toISOString()
        };

        this.addComment(id, newComment);
    }

    async deleteComment(ticketId: string, commentId: string): Promise<void> {
        const comments = this.mockComments.get(ticketId);
        if (comments) {
            const filteredComments = comments.filter(comment => comment.id !== commentId);
            this.mockComments.set(ticketId, filteredComments);
        }
    }

    async getTeams(): Promise<Team[]> {
        return Array.from(this.mockTeams.values());
    }

    async me(): Promise<User | null> {
        const users = Array.from(this.mockUsers.values());
        return users.length > 0 ? users[0] : null;
    }

    async isTicketComplete(ticketId: string): Promise<boolean> {
        const ticket = this.mockTickets.get(ticketId);
        if (!ticket) {
            return false;
        }

        // Check if the ticket state indicates completion
        const completedStates = ['done', 'closed', 'resolved', 'completed'];
        return completedStates.some(state => 
            ticket.state.name.toLowerCase().includes(state) || 
            ticket.state.id.toLowerCase().includes(state)
        );
    }

    async getAllTickets(): Promise<Ticket[]> {
        return Array.from(this.mockTickets.values());
    }

    async getAllProjects(): Promise<Project[]> {
        return Array.from(this.mockProjects.values());
    }

    async configureWebhook(): Promise<{ webhookId: string, webhookSecret: string } | null> {
        // Mock webhook configuration
        return {
            webhookId: `mock-webhook-${Date.now()}`,
            webhookSecret: `mock-secret-${Math.random().toString(36).substr(2, 20)}`
        };
    }

    async searchItemsForTicket(id: string): Promise<SearchItem[]> {
        return this.mockSearchItems.get(id) || [];
    }

    async searchItemsForProject(id: string): Promise<SearchItem[]> {
        // Return search items for all tickets in the project
        const projectTickets = Array.from(this.mockTickets.values())
            .filter(ticket => ticket.project?.id === id);
        
        const allSearchItems: SearchItem[] = [];
        for (const ticket of projectTickets) {
            const ticketSearchItems = this.mockSearchItems.get(ticket.id) || [];
            allSearchItems.push(...ticketSearchItems);
        }
        
        return allSearchItems;
    }

    async associateCommitsToTicket(ticketId: string, commits: CommitAssociation[], branchName: string): Promise<void> {
        this.mockCommits.set(ticketId, commits);
    }

    // Helper methods for testing

    /**
     * Get all mock data for inspection
     */
    getMockData() {
        return {
            tickets: Array.from(this.mockTickets.values()),
            users: Array.from(this.mockUsers.values()),
            teams: Array.from(this.mockTeams.values()),
            projects: Array.from(this.mockProjects.values()),
            states: Array.from(this.mockStates.values()),
            milestones: Array.from(this.mockMilestones.values()),
            comments: Object.fromEntries(this.mockComments),
            commits: Object.fromEntries(this.mockCommits),
            searchItems: Object.fromEntries(this.mockSearchItems)
        };
    }

    /**
     * Clear all mock data
     */
    clearAllData() {
        this.mockTickets.clear();
        this.mockUsers.clear();
        this.mockTeams.clear();
        this.mockProjects.clear();
        this.mockStates.clear();
        this.mockMilestones.clear();
        this.mockComments.clear();
        this.mockCommits.clear();
        this.mockSearchItems.clear();
    }

    /**
     * Get ticket count
     */
    getTicketCount(): number {
        return this.mockTickets.size;
    }

    /**
     * Check if a ticket exists
     */
    hasTicket(id: string): boolean {
        return this.mockTickets.has(id);
    }

    private initializeDefaultData() {
        // Create default test data
        const defaultUser: User = {
            id: 'mock-user-1',
            name: 'Mock User',
            email: 'mock@example.com'
        };

        const defaultTeam: Team = {
            id: 'mock-team-1',
            name: 'Mock Team',
            key: 'MT'
        };

        const defaultProject: Project = {
            id: 'mock-project-1',
            name: 'Mock Project',
            description: 'A project focused on implementing and maintaining secure user authentication and access control for the application.',
            updates: []
        };

        const defaultState: TicketState = {
            id: 'mock-state-1',
            name: 'To Do'
        };

        const defaultMilestone: Milestone = {
            id: 'mock-milestone-1',
            name: 'Mock Milestone'
        };

        this.mockUsers.set(defaultUser.id, defaultUser);
        this.mockTeams.set(defaultTeam.id, defaultTeam);
        this.mockProjects.set(defaultProject.id, defaultProject);
        this.mockStates.set(defaultState.id, defaultState);
        this.mockMilestones.set(defaultMilestone.id, defaultMilestone);
    }

    private createDefaultUser(): User {
        return {
            id: 'default-user',
            name: 'Default User',
            email: 'default@example.com'
        };
    }
}
