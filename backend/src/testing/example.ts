import { OwnerTestEnvironment, TestScenario } from './OwnerTestEnvironment';
import { Ticket } from '../shared/TicketSystem';

// Example of how to create and run custom test scenarios
async function runCustomScenarios() {
    const testEnv = new OwnerTestEnvironment();

    // Example 1: Test a bug fix commit
    const bugFixScenario: TestScenario = {
        name: 'Bug Fix Commit',
        description: 'Test how the system handles a bug fix commit',
        githubEvent: {
            username: 'developer',
            installationId: 123,
            repositoryName: 'my-app',
            eventType: 'push',
            branch: 'main',
            commits: [
                {
                    sha: 'fix123',
                    name: 'fix: resolve memory leak in user session',
                    fileDiffs: [
                        {
                            filename: 'src/session.ts',
                            diff: '@@ -15,6 +15,7 @@\n   cleanup() {\n     this.timer = null;\n+    this.data = null;\n     this.isActive = false;\n   }\n'
                        }
                    ]
                }
            ],
            repository: {
                id: 123,
                name: 'my-app',
                owner: 'developer',
                defaultBranch: 'main'
            },
            sender: {
                login: 'developer',
                email: 'dev@company.com'
            }
        },
        ticketSystemState: {
            tickets: [
                {
                    id: 'bug-001',
                    identifier: 'BUG-001',
                    title: 'Memory leak in user sessions',
                    description: 'User sessions are not being properly cleaned up, causing memory leaks',
                    state: { id: 'in-progress', name: 'In Progress' },
                    assignee: { id: 'user-1', name: 'Developer' },
                    priority: 1,
                    labels: [],
                    estimate: 2,
                    dueDate: '2024-01-20',
                    project: { id: 'proj-1', name: 'Core System' },
                    team: { id: 'team-1', name: 'Backend Team', key: 'BE' },
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            ],
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

    // Example 2: Test a feature PR being merged
    const featureMergeScenario: TestScenario = {
        name: 'Feature PR Merge',
        description: 'Test how the system handles a feature PR being merged',
        githubEvent: {
            username: 'developer',
            installationId: 123,
            repositoryName: 'my-app',
            eventType: 'pull_request.merged',
            branch: 'feature/new-dashboard',
            commits: [],
            pullRequest: {
                id: 'pr-123',
                number: 123,
                title: 'feat: add new analytics dashboard',
                body: 'This PR adds a new analytics dashboard with real-time metrics and charts.',
                state: 'closed',
                merged: true,
                head: {
                    ref: 'feature/new-dashboard',
                    sha: 'feature123'
                },
                base: {
                    ref: 'main',
                    sha: 'main456'
                },
                user: {
                    login: 'developer',
                    email: 'dev@company.com'
                }
            },
            repository: {
                id: 123,
                name: 'my-app',
                owner: 'developer',
                defaultBranch: 'main'
            },
            sender: {
                login: 'developer',
                email: 'dev@company.com'
            }
        },
        ticketSystemState: {
            tickets: [
                {
                    id: 'feat-001',
                    identifier: 'FEAT-001',
                    title: 'Add new analytics dashboard',
                    description: 'Create a new analytics dashboard with real-time metrics',
                    state: { id: 'in-review', name: 'In Review' },
                    assignee: { id: 'user-1', name: 'Developer' },
                    priority: 2,
                    labels: [],
                    estimate: 8,
                    dueDate: '2024-01-25',
                    project: { id: 'proj-2', name: 'Analytics' },
                    team: { id: 'team-2', name: 'Frontend Team', key: 'FE' },
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            ],
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

    // Add scenarios to test environment
    testEnv.addScenario(bugFixScenario);
    testEnv.addScenario(featureMergeScenario);

    // Run all scenarios
    console.log('Running custom scenarios...');
    const results = await testEnv.runAllScenarios();

    // Display results
    results.forEach((result, index) => {
        console.log(`\n--- Scenario ${index + 1}: ${result.scenario.name} ---`);
        if (result.success) {
            console.log('✅ PASSED');
            console.log(`Execution time: ${result.executionTime}ms`);
        } else {
            console.log('❌ FAILED');
            console.log(`Error: ${result.error}`);
        }
    });
}

// Example of how to create a scenario programmatically
function createScenarioFromTemplate(
    eventType: 'push' | 'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.closed' | 'pull_request.merged',
    username: string,
    repoName: string,
    commitMessage: string,
    existingTickets: Ticket[] = []
): TestScenario {
    return {
        name: `${eventType} - ${username}/${repoName}`,
        description: `Test ${eventType} event`,
        githubEvent: {
            username,
            installationId: 123,
            repositoryName: repoName,
            eventType,
            branch: 'main',
            commits: [
                {
                    sha: Math.random().toString(36).substring(7),
                    name: commitMessage,
                    fileDiffs: []
                }
            ],
            repository: {
                id: 123,
                name: repoName,
                owner: username,
                defaultBranch: 'main'
            },
            sender: {
                login: username,
                email: `${username}@example.com`
            }
        },
        ticketSystemState: {
            tickets: existingTickets,
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

// Example usage
if (require.main === module) {
    runCustomScenarios().catch(console.error);
}

export { runCustomScenarios, createScenarioFromTemplate };
