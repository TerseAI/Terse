import { OwnerTestEnvironment, TestScenario } from './OwnerTestEnvironment';
import chalk from 'chalk';

async function main() {
    const testEnv = new OwnerTestEnvironment();
    
    // Add some predefined scenarios
    setupTestScenarios(testEnv);
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'list':
            listScenarios(testEnv);
            break;
        case 'run':
            const scenarioName = args[1];
            if (!scenarioName) {
                console.error('Please provide a scenario name');
                console.log('Available scenarios:');
                listScenarios(testEnv);
                return;
            }
            await runSingleScenario(testEnv, scenarioName);
            break;
        case 'run-all':
            await runAllScenarios(testEnv);
            break;
        case 'interactive':
            await runInteractiveMode(testEnv);
            break;
        default:
            console.log(`
Usage: npm run test:owner [command] [scenario-name]

Commands:
  list                    - List all available test scenarios
  run <scenario-name>     - Run a specific scenario
  run-all                 - Run all scenarios
  interactive             - Run in interactive mode to create custom scenarios

Examples:
  npm run test:owner list
  npm run test:owner run "Push Event - testuser/test-repo"
  npm run test:owner run-all
  npm run test:owner interactive
            `);
    }
}

function setupTestScenarios(testEnv: OwnerTestEnvironment) {
    // Basic push event scenario
    testEnv.addScenario(OwnerTestEnvironment.createPushEventScenario(
        'testuser',
        'test-repo',
        [
            {
                sha: 'abc123',
                name: 'feat: add new feature',
                fileDiffs: [
                    {
                        filename: 'src/feature.ts',
                        diff: '@@ -0,0 +1,10 @@\n+export function newFeature() {\n+  return "Hello World";\n+}\n'
                    }
                ]
            }
        ]
    ));

    // PR opened scenario
    testEnv.addScenario(OwnerTestEnvironment.createPullRequestScenario(
        'pull_request.opened',
        'testuser',
        'test-repo',
        1
    ));

    // PR merged scenario
    testEnv.addScenario(OwnerTestEnvironment.createPullRequestScenario(
        'pull_request.merged',
        'testuser',
        'test-repo',
        1
    ));

    // Scenario with existing tickets
    const scenarioWithTickets: TestScenario = {
        name: 'Push with existing tickets',
        description: 'Test push event when there are existing tickets in the system',
        githubEvent: {
            username: 'testuser',
            installationId: 123,
            repositoryName: 'test-repo',
            eventType: 'push',
            branch: 'ENG-123-fix-resolve-authentication-bug',
            commits: [
                {
                    sha: 'def456',
                    name: 'fix: resolve bug in authentication',
                    fileDiffs: [
                        {
                            filename: 'src/auth.ts',
                            diff: '@@ -10,7 +10,7 @@\n-  if (!user) {\n+  if (!user || !user.isValid) {\n     throw new Error("Invalid user");\n   }\n'
                        }
                    ]
                }
            ],
            repository: {
                name: 'test-repo',
                owner: 'testuser',
                defaultBranch: 'main'
            },
            sender: {
                login: 'testuser',
                email: 'testuser@example.com'
            }
        },
        ticketSystemState: {
            tickets: [
                {
                    id: 'ticket-1',
                    identifier: 'ENG-123',
                    title: 'Fix authentication bug',
                    description: 'Users are able to access protected routes without proper authentication',
                    state: { id: 'in-progress', name: 'In Progress' },
                    assignee: { id: 'user-1', name: 'Test User' },
                    priority: 1,
                    labels: [],
                    estimate: 4,
                    dueDate: '2024-01-15',
                    project: { id: 'proj-1', name: 'Authentication System' },
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
            users: [
                { id: 'user-1', name: 'Test User', email: 'testuser@example.com' }
            ],
            teams: [
                { id: 'team-1', name: 'Backend Team', key: 'BE' }
            ],
            projects: [
                { id: 'proj-1', name: 'Authentication System' }
            ]
        },

    };
    
    testEnv.addScenario(scenarioWithTickets);
}

function listScenarios(testEnv: OwnerTestEnvironment) {
    console.log(chalk.blue('\nAvailable Test Scenarios:'));
    console.log('========================\n');
    
    // This would need to be implemented to expose scenarios
    // For now, we'll just show the predefined ones
    const scenarios = [
        'Push Event - testuser/test-repo',
        'PR pull_request.opened - testuser/test-repo#1',
        'PR pull_request.merged - testuser/test-repo#1',
        'Push with existing tickets'
    ];
    
    scenarios.forEach((scenario, index) => {
        console.log(`${index + 1}. ${chalk.green(scenario)}`);
    });
    console.log('');
}

async function runSingleScenario(testEnv: OwnerTestEnvironment, scenarioName: string) {
    console.log(chalk.blue(`\nRunning scenario: ${scenarioName}`));
    console.log('=' .repeat(50));
    
    try {
        const result = await testEnv.runScenario(scenarioName);
        displayTestResult(result);
    } catch (error) {
        console.error(chalk.red(`Error running scenario: ${error}`));
    }
}

async function runAllScenarios(testEnv: OwnerTestEnvironment) {
    console.log(chalk.blue('\nRunning all test scenarios...'));
    console.log('=' .repeat(50));
    
    try {
        const results = await testEnv.runAllScenarios();
        
        console.log(chalk.blue(`\nTest Results Summary:`));
        console.log('=' .repeat(50));
        
        let passed = 0;
        let failed = 0;
        
        results.forEach((result, index) => {
            if (result.success) {
                passed++;
                console.log(chalk.green(`✓ ${result.scenario.name}`));
            } else {
                failed++;
                console.log(chalk.red(`✗ ${result.scenario.name} - ${result.error}`));
            }
        });
        
        console.log(`\n${chalk.green(`Passed: ${passed}`)} | ${chalk.red(`Failed: ${failed}`)} | ${chalk.blue(`Total: ${results.length}`)}`);
        
        // Show detailed results for failed tests
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
            console.log(chalk.red('\nFailed Test Details:'));
            console.log('=' .repeat(50));
            failedResults.forEach(result => {
                displayTestResult(result);
            });
        }
        
    } catch (error) {
        console.error(chalk.red(`Error running scenarios: ${error}`));
    }
}

async function runInteractiveMode(testEnv: OwnerTestEnvironment) {
    console.log(chalk.blue('\nInteractive Test Mode'));
    console.log('=' .repeat(50));
    console.log('This mode allows you to create custom test scenarios.');
    console.log('For now, this is a placeholder for future interactive functionality.');
    console.log('Use the predefined scenarios or modify the testRunner.ts file to add custom scenarios.');
}

function displayTestResult(result: any) {
    console.log(chalk.blue(`\nScenario: ${result.scenario.name}`));
    console.log(chalk.gray(`Description: ${result.scenario.description}`));
    console.log(chalk.gray(`Event Type: ${result.scenario.githubEvent.eventType}`));
    console.log(chalk.gray(`Repository: ${result.scenario.githubEvent.repositoryName}`));
    console.log(chalk.gray(`User: ${result.scenario.githubEvent.username}`));
    
    if (result.success) {
        console.log(chalk.green(`✓ Test passed (${result.executionTime}ms)`));
        
        if (result.activityOverview) {
            console.log(chalk.blue('\nActivity Overview:'));
            console.log(JSON.stringify(result.activityOverview, null, 2));
        }
    } else {
        console.log(chalk.red(`✗ Test failed (${result.executionTime}ms)`));
        console.log(chalk.red(`Error: ${result.error}`));
    }
    
    console.log('');
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main, setupTestScenarios };
