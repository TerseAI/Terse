# Owner Testing Environment

A simple way to test the `Owner.ts` logic with different GitHub events and ticket system states.

## Quick Start

### 1. List available scenarios
```bash
npm run test:owner list
```

### 2. Run a specific scenario
```bash
npm run test:owner run "Push Event - testuser/test-repo"
```

### 3. Run all scenarios
```bash
npm run test:owner run-all
```

## What it does

This testing environment allows you to:

- Test how the AI agent responds to different GitHub events (push, PR opened, PR merged, etc.)
- Test with different ticket system states (empty, existing tickets, different ticket states)
- See the AI-generated activity overview for each scenario
- Quickly iterate on changes to the Owner logic

## Available Scenarios

1. **Push Event - testuser/test-repo**: Basic push event with a feature commit
2. **PR pull_request.opened - testuser/test-repo#1**: Pull request opened event
3. **PR pull_request.merged - testuser/test-repo#1**: Pull request merged event
4. **Push with existing tickets**: Push event when there are existing tickets in the system

## Adding Custom Scenarios

Edit `testRunner.ts` and add your scenario to the `setupTestScenarios` function:

```typescript
function setupTestScenarios(testEnv: OwnerTestEnvironment) {
    // ... existing scenarios ...
    
    // Add your custom scenario
    const myScenario: TestScenario = {
        name: 'My Custom Test',
        description: 'Test a specific scenario',
        githubEvent: {
            username: 'developer',
            installationId: 123,
            repositoryName: 'my-app',
            eventType: 'push',
            branch: 'main',
            commits: [
                {
                    sha: 'abc123',
                    name: 'feat: add new feature',
                    fileDiffs: []
                }
            ],
            repository: {
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
    
    testEnv.addScenario(myScenario);
}
```

## Understanding Results

Each test run shows:
- Whether the scenario executed successfully
- Execution time
- AI-generated activity overview (if successful)

Since the AI responses are non-deterministic, focus on whether the system behaves correctly rather than exact output matches.

## Simple Test

Run the simple test to verify everything works:

```bash
npx tsx src/testing/simpleTest.ts
```
