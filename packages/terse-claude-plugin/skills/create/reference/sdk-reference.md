# Terse SDK Reference

## About Terse

Terse is an automation platform where developers build background AI agents in TypeScript or Python. Each agent reacts to events from integrated services (GitHub, Slack, Linear, etc.) and takes actions using an AI-powered agent runner with access to those same services as tools.

## Language support

Detect the project language from the root markers:

- TypeScript: `package.json` and `src/index.ts`
- Python: `pyproject.toml` and `src/main.py`

Generated helper files:

- TypeScript: `src/terse.generated.ts`
- Python: `src/terse_generated.py`

Use `terse init [name] --language <ts|typescript|py|python>` to choose the language up front. After scaffold, `terse generate`, `terse run`, `terse test`, and `terse deploy` auto-detect the project from those markers.

Python support is narrower than TypeScript today. The generated Python surface focuses on `Schedule`, `Attio`, `Snowflake`, and deterministic wrappers for supported Attio and Snowflake tools. If a Python project does not expose a helper in `terse_generated.py`, do not invent one.

## Language-specific naming

| Concern | TypeScript | Python |
|---------|------------|--------|
| SDK import | `terse-sdk` | `terse_sdk` |
| Entry file | `src/index.ts` | `src/main.py` |
| Generated import | `./terse.generated` | `terse_generated` |
| Prompt context | `event.formatForAgentRunner()` | `event.formatted_content` |
| Run to completion | `agent.runAndWait(prompt, event?)` | `agent.run_and_wait(prompt, event)` |
| Direct tool call | `agent.executeTool(toolName, params?)` | `agent.execute_tool(tool_name, params)` |

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

Python:

```
my-project/
├── src/
│   ├── main.py               # Job definitions — the entry point
│   └── terse_generated.py    # Auto-generated helpers (never edit)
├── pyproject.toml
├── .python-version
└── .env                      # TERSE_API_KEY (required)
```

- TypeScript jobs are registered with `client.createJob()` in `src/index.ts`.
- Python jobs are registered with `@app.job(...)` in `src/main.py`.
- The generated file for the current language is the source of truth for available triggers, skills, resources, and deterministic wrappers.

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

Python registers jobs with `@app.job(...)` rather than a `CreateJobParameters` object, but the same concepts apply: `name`, `triggers`, `skills`, optional `filter`, handler, optional `webhook_url`, and optional `tool_approvals`.

## TerseAgent API

| Goal | TypeScript | Python | Description |
|------|------------|--------|-------------|
| Run to completion | `agent.runAndWait(prompt, event?)` | `agent.run_and_wait(prompt, event)` | Use for AI-driven decisions such as summarize, analyze, or triage. |
| Stream output | `agent.run(prompt, event?)` | `agent.run(prompt, event)` | Returns streamed agent events. |
| Direct tool call by name | `agent.executeTool(toolName, params?)` | `agent.execute_tool(tool_name, params)` | Bypass the model and call a deterministic tool directly. |
| Generated tool wrappers | `agent.tools.<integration>.<method>(params)` | `agent.tools.<integration>.<method>(params)` | Type-safe direct tool calls generated from connected integrations. |

### When to Use What

| Approach | Use When |
|----------|----------|
| `Agent.runAndWait(prompt)` | The agent needs to decide what to do — summarize, analyze, choose actions |
| `Agent.tools.*` / `Agent.executeTool()` | You know exactly what tool call to make — send a specific message, create a specific issue |
| Combination | Do a deterministic action first (send message), then let the agent decide (reply in thread with analysis) |

## Triggers

Triggers define what events fire a job. They come from the generated helper file for the current language.

The examples below show the broader TypeScript trigger surface. In Python, only use the triggers and helpers that actually exist in `src/terse_generated.py`.

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

The examples below show the broader TypeScript skill surface. In Python, only use helpers exposed by `src/terse_generated.py` today, primarily `Attio.skill()` and `Snowflake.skill()`.

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

Python event classes expose the same event content through attributes like `event.integration_type`, `event.event_type`, `event.formatted_content`, and `event.debug_log`.

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

| Command | Description |
|---------|-------------|
| `terse init [name] --language <ts|typescript|py|python>` | Scaffold a new project. Defaults to TypeScript. |
| `terse login` | Authenticate and write `TERSE_API_KEY` into `.env` |
| `terse generate` | Regenerate `src/terse.generated.ts` or `src/terse_generated.py` from connected integrations |
| `terse integrate` | Open the web UI to connect services |
| `terse run [job] --event <json>` | Run a job with event JSON |
| `terse run [job] --event-file <path>` | Run a job with event JSON from a file |
| `terse test [job]` | Fetch real sample events and run interactively |
| `terse deploy` | Deploy all jobs (syncs — removed jobs deleted remotely) |

### Typical Workflow
```bash
terse init my-project
# or: terse init my-project --language python
cd my-project
terse integrate          # connect services in web UI
terse generate           # pull typed integration constants
# edit src/index.ts or src/main.py
terse test               # test with real events
terse deploy             # ship it
```

Python projects use `uv` under the hood for local dependency installation and execution.
