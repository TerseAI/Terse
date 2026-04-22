# Terse SDK Reference

## About Terse

Terse is an automation platform where developers build background AI agents in TypeScript. Each agent reacts to events from integrated services (GitHub, Slack, Linear, etc.) and takes actions using an AI-powered agent runner with access to those same services as tools.

## Project Structure

TypeScript:

```
my-project/
├── src/
│   ├── index.ts              # Job definitions — the entry point
│   └── terse.generated.ts    # Auto-generated integration types (never edit)
├── package.json
├── tsconfig.json
└── .env                      # TERSE_API_KEY (required)
```

- TypeScript jobs are registered with `client.createJob()` in `src/index.ts`.
- `src/terse.generated.ts` is the source of truth for available triggers, skills, resources, and deterministic wrappers.

## CreateJobParameters

```typescript
type CreateJobParameters = {
    name: string                                       // unique human-readable name
    triggers: TypedTrigger[]                           // one or more trigger configs
    skills: ConfigInstance[]                            // integration configs (agent tools)
    filter?: (event) => boolean | Promise<boolean>     // return false to skip
    onTrigger: (event, Agent: TerseAgent) => Promise<void>  // automation logic
    webhookURL?: string                                // optional webhook
}
```

## TerseAgent API

| Goal | TypeScript | Description |
|------|------------|-------------|
| Run to completion | `agent.runAndWait(prompt, event?)` | Use for AI-driven decisions such as summarize, analyze, or triage. |
| Stream output | `agent.run(prompt, event?)` |  Returns streamed agent events. |
| Direct tool call by name | `agent.executeTool(toolName, params?)` | Bypass the model and call a deterministic tool directly. |
| Generated tool wrappers | `agent.tools.<integration>.<method>(params)` |  Type-safe direct tool calls generated from connected integrations. |

### When to Use What

| Approach | Use When |
|----------|----------|
| `Agent.runAndWait(prompt)` | The agent needs to decide what to do — summarize, analyze, choose actions |
| `Agent.tools.*` / `Agent.executeTool()` | You know exactly what tool call to make — send a specific message, create a specific issue |
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

## Skills (Output Configs)

Skills give the agent tools to act on external systems. The agent can **only** interact with systems it has skill configs for.

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
| `terse init [name]` | Scaffold a new project. |
| `terse login` | Authenticate and write `TERSE_API_KEY` into `.env` |
| `terse generate` | Regenerate `src/terse.generated.ts` from connected integrations |
| `terse integrate` | Connect third-party integrations and re-run `terse generate` |
| `terse run [job] --event <json>` | Run a job with an inline serialized event JSON |
| `terse run [job] --event-file <path>` | Run a job with a serialized event JSON from a file |
| `terse test [job]` | Fetch real sample events and run interactively |
| `terse history [job]` | List past production runs for a deployed job (use `--triggers` / `--events` / `--run-id` to drill in; `--json` to pipe into tools) |
| `terse replay <run-id>` | Re-run a past production run locally with verbose agent output |
| `terse deploy` | Deploy all jobs (syncs — removed jobs deleted remotely) |

### Typical Workflow
```bash
terse init my-project
cd my-project
terse integrate          # connect services in web UI
terse generate           # pull typed integration constants
# edit src/index.ts
terse test               # test with real events
terse deploy             # ship it
```
