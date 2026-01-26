import { GithubAppUnifiedEventRequest, Commit, FileDiff } from '../routes/GithubTypes';
import { Ticket, TicketState, User as TicketUser, Team, Project, TicketSystemType } from '../shared/TicketSystem';
import { Session } from "../types/session";
import { Search } from '../searchClient';
import { SearchItem, SearchResult, SearchOptions } from '../search/SearchItem';
import Owner from '../theOwner/Owner';
import { db } from '../prismaClient';
import { User } from '../types/prisma';
import { TicketManager } from '../ticketing/TicketIntegration';
import { ActivityOverview } from '../agent/agents/Analyzer';
import { MockTicketManager } from './MockTicketManager';

export interface TestScenario {
    name: string;
    description: string;
    githubEvent: GithubAppUnifiedEventRequest;
    ticketSystemState: {
        tickets: Ticket[];
        states: TicketState[];
        users: TicketUser[];
        teams: Team[];
        projects: Project[];
    };
}

export interface TestResult {
    scenario: TestScenario;
    success: boolean;
    error?: string;
    activityOverview?: ActivityOverview;
    executionTime: number;
}

export class MockSearch implements Search {
    private mockResults: SearchResult[] = [];

    constructor(mockResults: SearchResult[] = []) {
        this.mockResults = mockResults;
    }

    async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
        return this.mockResults;
    }

    async embed(text: string): Promise<number[]> {
        return new Array(1536).fill(0); // Mock embedding
    }

    async insert(item: SearchItem): Promise<void> {
        // Mock implementation
    }

    async bulkInsert(items: SearchItem[]): Promise<void> {
        // Mock implementation
    }

    async delete(entityId: string, entityType: string, teamId: string): Promise<void> {
        // Mock implementation
    }

    async update(item: SearchItem): Promise<void> {
        // Mock implementation
    }

    setMockResults(results: SearchResult[]) {
        this.mockResults = results;
    }
}

export class MockSession implements Session {
    user: User;
    teamId: string;
    searchSystem: Search;
    isUserInitiated: boolean;
    ticketManager?: TicketManager;
    currentUser?: TicketUser;

    constructor(user: User, teamId: string, searchSystem: Search) {
        this.user = user;
        this.teamId = teamId;
        this.searchSystem = searchSystem;
        this.isUserInitiated = true;
    }
}

export class OwnerTestEnvironment {
    private scenarios: TestScenario[] = [];
    private mockSearch: MockSearch;
    private mockSession: MockSession;
    private mockTicketManager: MockTicketManager;

    constructor() {
        this.mockSearch = new MockSearch();
        this.mockTicketManager = new MockTicketManager();
        this.mockSession = new MockSession(
            {
                id: 'test-user-id',
                github_username: 'testuser',
                email: 'test@example.com',
                display_name: ' Test User',
                created_at: new Date(),
                updated_at: new Date(),
                is_placeholder: false
            },
            'test-team-id',
            this.mockSearch
        );
        
        // Wire up the mock ticket manager to the session
        this.mockSession.ticketManager = this.mockTicketManager;
    }

    addScenario(scenario: TestScenario) {
        this.scenarios.push(scenario);
    }

    async runScenario(scenarioName: string): Promise<TestResult> {
        const scenario = this.scenarios.find(s => s.name === scenarioName);
        if (!scenario) {
            throw new Error(`Scenario "${scenarioName}" not found`);
        }

        return await this.executeScenario(scenario);
    }

    async runAllScenarios(): Promise<TestResult[]> {
        const results: TestResult[] = [];
        for (const scenario of this.scenarios) {
            const result = await this.executeScenario(scenario);
            results.push(result);
        }
        return results;
    }

    private async executeScenario(scenario: TestScenario): Promise<TestResult> {
        const startTime = Date.now();
        
        try {
            // Setup mock ticket system state
            await this.setupMockTicketSystem(scenario.ticketSystemState);
            
            // Setup mock search results based on tickets
            const mockSearchResults = this.generateMockSearchResults(scenario.ticketSystemState.tickets);
            this.mockSearch.setMockResults(mockSearchResults);

            // Create Owner instance
            const owner = new Owner(this.mockSearch, this.mockSession);

            // Execute the event
            const activityOverview = await owner.handleUnifiedGitHubEvent(scenario.githubEvent);

            const executionTime = Date.now() - startTime;

            return {
                scenario,
                success: true,
                activityOverview: activityOverview || undefined,
                executionTime
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                scenario,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime
            };
        }
    }

    private async setupMockTicketSystem(state: TestScenario['ticketSystemState']) {
        // Clear any existing data and initialize with the scenario's ticket system state
        this.mockTicketManager.clearAllData();
        
        // Initialize the mock ticket manager with the scenario data (defaulting to Linear)
        this.mockTicketManager.initializeWithData({
            tickets: state.tickets,
            states: state.states,
            users: state.users,
            teams: state.teams,
            projects: state.projects,
            type: TicketSystemType.Linear
        });
        
        console.log('Mock ticket system initialized with:', {
            tickets: state.tickets.length,
            states: state.states.length,
            users: state.users.length,
            teams: state.teams.length,
            projects: state.projects.length,
            type: 'Linear'
        });
    }

    private generateMockSearchResults(tickets: Ticket[]): SearchResult[] {
        return tickets.map(ticket => ({
            id: `search-${ticket.id}`,
            entityId: ticket.id,
            entityType: 'ticket',
            content: `${ticket.title} - ${ticket.description || ''}`,
            similarity: 0.9,
            metadata: {
                title: ticket.title,
                description: ticket.description,
                state: ticket.state,
                priority: ticket.priority
            }
        }));
    }



    // Getter for the mock ticket manager (useful for testing)
    getMockTicketManager(): MockTicketManager {
        return this.mockTicketManager;
    }

    // Helper methods to create common test scenarios
    static createPushEventScenario(
        username: string = 'testuser',
        repositoryName: string = 'test-repo',
        commits: Commit[] = []
    ): TestScenario {
        return {
            name: `Push Event - ${username}/${repositoryName}`,
            description: `Test push event to ${repositoryName} by ${username}`,
            githubEvent: {
                username,
                installationId: 123,
                repositoryName,
                eventType: 'push',
                branch: 'main',
                commits,
                repository: {
                    id: 123,
                    name: repositoryName,
                    owner: username,
                    defaultBranch: 'main'
                },
                sender: {
                    login: username,
                    email: `${username}@example.com`
                }
            },
            ticketSystemState: {
                tickets: [],
                states: [
                    { id: 'todo', name: 'To Do' },
                    { id: 'in-progress', name: 'In Progress' },
                    { id: 'done', name: 'Done' }
                ],
                users: [],
                teams: [],
                projects: []
            }
        };
    }

    static createPushWithLinearProjectEnrichmentScenario(
        username: string = 'testuser',
        repositoryName: string = 'test-repo',
        commits: Commit[] = []
    ): TestScenario {
        return {
            name: `Push Event - ${username}/${repositoryName}`,
            description: `Test push event to ${repositoryName} by ${username}`,
            githubEvent: {
                username,
                installationId: 123,
                repositoryName,
                eventType: 'push',
                branch: 'main',
                commits,
                repository: {
                    id: 123,
                    name: repositoryName,
                    owner: username,
                    defaultBranch: 'main'
                },
                sender: {
                    login: username,
                    email: `${username}@example.com`
                }
            },
            ticketSystemState: {
                tickets: [
                    {
                        id: 'ticket-1',
                        title: 'Test Ticket',
                        project: { id: 'proj-1', name: 'Authentication System' },
                        identifier: '',
                        state: {
                            id: '',
                            name: ''
                        },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ],
                states: [
                    { id: 'todo', name: 'To Do' },
                    { id: 'in-progress', name: 'In Progress' },
                    { id: 'done', name: 'Done' }
                ],
                users: [],
                teams: [],
                projects: [
                    {
                        id: 'proj-1',
                        name: 'Authentication System',
                        description: 'A project focused on implementing and maintaining secure user authentication and access control for the application.',
                        updates: []
                    }
                ]
            }
        };
    }

    static createPullRequestScenario(
        eventType: 'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.closed' | 'pull_request.merged',
        username: string = 'testuser',
        repositoryName: string = 'test-repo',
        prNumber: number = 1
    ): TestScenario {
        return {
            name: `PR ${eventType} - ${username}/${repositoryName}#${prNumber}`,
            description: `Test ${eventType} for PR #${prNumber}`,
            githubEvent: {
                username,
                installationId: 123,
                repositoryName,
                eventType,
                branch: 'feature-branch',
                commits: [],
                pullRequest: {
                    id: `pr-${prNumber}`,
                    number: prNumber,
                    title: `Test PR ${prNumber}`,
                    body: 'This is a test pull request',
                    state: eventType.includes('closed') || eventType.includes('merged') ? 'closed' : 'open',
                    merged: eventType === 'pull_request.merged',
                    head: {
                        ref: 'feature-branch',
                        sha: 'abc123'
                    },
                    base: {
                        ref: 'main',
                        sha: 'def456'
                    },
                    user: {
                        login: username,
                        email: `${username}@example.com`
                    }
                },
                repository: {
                    id: 123,
                    name: repositoryName,
                    owner: username,
                    defaultBranch: 'main'
                },
                sender: {
                    login: username,
                    email: `${username}@example.com`
                }
            },
            ticketSystemState: {
                tickets: [],
                states: [
                    { id: 'todo', name: 'To Do' },
                    { id: 'in-progress', name: 'In Progress' },
                    { id: 'in-review', name: 'In Review' },
                    { id: 'done', name: 'Done' }
                ],
                users: [],
                teams: [],
                projects: []
            }
        };
    }
}
