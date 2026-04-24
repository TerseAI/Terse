# Terse SDK Reference

## About Terse

Terse is an automation platform where developers build background AI agents in TypeScript. Each agent reacts to events from integrated services (GitHub, Slack, Linear, etc.) and takes actions using an AI-powered agent runner with access to those same services as tools.

## Project Structure

TypeScript:

```
my-project/
├── src/
│   ├── terse.jobs.ts         # Canonical job entry file
│   ├── terse.generated.ts    # Auto-generated integration types (never edit)
│   └── index.ts              # Optional app startup file that can import terse.jobs.ts
├── package.json
├── tsconfig.json
└── .env.example              # Runtime env template
```

- TypeScript projects are detected from `package.json` and `tsconfig.json`.
- TypeScript jobs are typically registered with `createJob()` in `src/terse.jobs.ts`.
- The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.
- `src/terse.generated.ts` is the source of truth for available triggers, skills, resources, and deterministic wrappers.
- `terse login` stores CLI authentication in a user-level config file. Runtime code still reads `TERSE_API_KEY` from the environment where your app runs.

## CreateJobParameters

```typescript
type CreateJobParameters = {
    name: string                                       // unique human-readable name
    triggers: TypedTrigger[]                           // one or more trigger configs
    filter?: (event) => boolean | Promise<boolean>     // return false to skip
    onTrigger: (event) => Promise<void>                // automation logic
    remoteServerUrl?: string                           // optional webhook host
}
```

## TerseAgent API

| Goal | TypeScript | Description |
|------|------------|-------------|
| Run to completion | `agent.runAndWait(prompt, event?)` | Use for AI-driven decisions such as summarize, analyze, or triage. |
| Stream output | `agent.run(prompt, event?)` | Returns streamed agent events. |
| Direct tool call by name | `agent.executeTool(toolName, params?)` | Bypass the model and call a deterministic tool directly. |
| Generated tool wrappers | `agent.tools.<integration>.<method>(params)` | Type-safe direct tool calls generated from connected integrations. |

### When to Use What

| Approach | Use When |
|----------|----------|
| `agent.runAndWait(prompt)` | The agent needs to decide what to do — summarize, analyze, choose actions |
| `agent.tools.*` / `agent.executeTool()` | You know exactly what tool call to make — send a specific message, create a specific issue |
| Combination | Do a deterministic action first (send message), then let the agent decide (reply in thread with analysis) |

## Triggers

Triggers define what events fire a job. They come from `src/terse.generated.ts`.

The examples below show the broader TypeScript trigger surface.

### GitHub
```typescript
GitHub.onPROpened({ repo: Repos.MyOrg.MyRepo })
GitHub.onPRMerged({ repo: Repos.MyOrg.MyRepo })
GitHub.onPush({ repo: Repos.MyOrg.MyRepo })
GitHub.onIssueOpened({ repo: Repos.MyOrg.MyRepo })
```

### Slack
```typescript
Slack.onMessage({ channel: SlackChannel.General })
```

### Linear
```typescript
Linear.onIssueCreated({ team: LinearTeam.Engineering })
Linear.onIssueUpdated({ team: LinearTeam.Engineering })
```

### Gmail
```typescript
Gmail.onNewEmail()
```

### WorkOS
```typescript
WorkOS.onUserCreated()
WorkOS.onMembershipCreated()
WorkOS.onInvitationAccepted()
WorkOS.onOrganizationCreated()
```

### Cron / Schedule
```typescript
Schedule.every("0 9 * * 1")    // every Monday at 9 AM
Schedule.every("*/30 * * * *") // every 30 minutes
```

## Skills (Model Access)

Skills control what the model can use during `run()` and `runAndWait()`. They do not fully describe what your code can call deterministically through generated wrappers.

The examples below show the broader TypeScript skill surface.

```typescript
skills: [
    GitHub.skill({ repos: [Repos.MyOrg.MyRepo] }),
    Slack.skill({ channel: SlackChannel.General }),
    Linear.skill({ team: LinearTeam.Engineering }),
    Notion.skill({ database: NotionDB.Tasks }),
    Gmail.skill(),
    PostHog.skill({ project: PostHogProject.Main }),
    Datadog.skill({ index: DatadogIndex.Main }),
    LaunchDarkly.skill({ project: LDProject.Default }),
    Attio.skill(),
    Snowflake.skill(),
    Terse.skill(),  // web search
]
```

Use `skills` to scope model-visible integrations.
Use `agent.tools.*` and `agent.executeTool()` for deterministic calls from code.

## Event Types

### Trigger interface
```typescript
event.integrationType       // IntegrationType enum
event.eventType             // specific event type string
event.formatForAgentRunner() // formatted string for agent prompts — always include in your prompt
event.debugLog()            // debug info string
```

### GithubPRTrigger
```typescript
event.pullRequest.number    // PR number
event.pullRequest.title     // PR title
event.pullRequest.body      // PR description
event.pullRequest.state     // "open" | "closed"
event.pullRequest.merged    // boolean
event.pullRequest.head.ref  // source branch
event.pullRequest.base.ref  // target branch
event.pullRequest.author    // { login, email? }
event.pullRequest.url       // PR URL
event.sender                // { login, email? }
event.repository            // { id, name, owner, defaultBranch }
event.commits               // [{ sha, message, fileDiffs: [{ filename, diff }] }]
```

### GithubPushTrigger
```typescript
event.branch                // branch that was pushed to
event.sender                // { login, email? }
event.repository            // { id, name, owner, defaultBranch }
event.commits               // [{ sha, message, fileDiffs: [{ filename, diff }] }]
```

### WorkOS Events
```typescript
// WorkOSUserTrigger
event.user.id / event.user.email / event.user.firstName / event.user.lastName

// WorkOSMembershipTrigger
event.membership.userId / event.membership.organizationId / event.membership.role.slug

// WorkOSInvitationTrigger
event.invitation.email / event.invitation.organizationId / event.invitation.state
```

### Type Guards
```typescript
import { isGithubPRTrigger, isGithubPushTrigger, isWorkOSUserTrigger } from "terse-sdk"

if (isGithubPRTrigger(event)) {
    // event is typed as GithubPRTrigger
}
```

## Terse CLI

The authoritative reference for every command and flag lives at https://docs.useterse.ai/reference/cli — pull it whenever you need details. Quick summary:

| Command | Description |
|---------|-------------|
| `terse init [name]` | Scaffold a new project. Use `--non-interactive` (or `-y`) for non-interactive setup when authentication is already available. |
| `terse attach` | Add Terse to an existing project. Use `--non-interactive` (or `-y`) for non-interactive attach flows. |
| `terse login` | Authenticate and store the CLI API key in user config. |
| `terse generate` | Regenerate `src/terse.generated.ts` from connected integrations. |
| `terse integrate` | Interactive integration manager. |
| `terse integrate list|describe|connect|wait|disconnect` | Machine-friendly integration inspection and connection flows. Use `--json` for agent/CI tooling. |
| `terse test [job]` | Fetch real sample events and run interactively. Requires a TTY. |
| `terse test list|show|run` | Machine-friendly sample event listing, inspection, and execution. |
| `terse history [job]` | List past production runs for a deployed job (use `--triggers` / `--events` / `--run-id` to drill in; `--json` to pipe into tools) |
| `terse replay <run-id>` | Re-run a past production run locally with verbose agent output |
| `terse deploy` | Deploy all jobs (syncs — removed jobs deleted remotely) |
| `terse dashboard` | Open the Terse web app in your browser |
| `terse docs` | Open Terse documentation in your browser |

When you use `--json`, CLI errors may be emitted as structured JSON instead of prose. If `error.actionRequired` is `true`, or the process exits with code `2`, stop and surface the next step or URL instead of retrying blindly.

### Typical Interactive Workflow
```bash
terse init my-project
cd my-project
terse integrate
terse generate           # pull typed integration constants
# edit src/terse.jobs.ts
terse test               # interactive test with real events
terse deploy             # ship it
```

### Fresh Project Agent-Friendly Workflow
```bash
terse init               # or: terse init my-project
terse integrate list --json
terse integrate describe github --json
terse generate
# edit src/terse.jobs.ts
terse test list "my-job" --json
terse test show <id> "my-job" --json
terse test run "my-job" --id <id>
terse deploy
```

When the target directory is brand-new, missing `package.json`, `tsconfig.json`, and `src/terse.generated.ts` is expected before `terse init`.

### Existing Project Agent-Friendly Workflow
```bash
terse integrate list --json
terse integrate describe github --json
terse generate
# edit src/terse.jobs.ts
terse test list "my-job" --json
terse test show <id> "my-job" --json
terse test run "my-job" --id <id>
terse deploy
```
