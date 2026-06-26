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
- `terse auth login` stores CLI authentication in a user-level config file. Runtime code still reads `TERSE_API_KEY` from the environment where your app runs.

## CreateJobParameters

```typescript
type CreateJobParameters = {
    name: string                                        // unique human-readable name
    triggers: TypedTrigger[]                            // one or more trigger configs
    states?: StateDefinition[]                          // typed persistent key/value state (see below)
    filter?: (event, state) => boolean | Promise<boolean>  // return false to skip
    onTrigger: (event, state) => Promise<void>          // automation logic
    remoteServerUrl?: string                            // optional webhook host
}
```

## Typed state: `states` + `state.get`/`state.set`

`states` declares persistent state on the job as a list of `{ key, value }`, where `value` is a Zod schema. Both `filter` and `onTrigger` receive a `state` object as their second argument. `state.get(key)` and `state.set(key, value)` are narrowed to the declared keys, with each value typed and validated against that key's schema. `get` returns `undefined` when a key has never been set.

State is stored as JSON in the project volume, in a namespace the agent cannot read or write. Validation runs in the SDK.

```typescript
import { createJob } from "terse-sdk"
import { z } from "zod"

const Profile = z.object({ name: z.string(), tier: z.enum(["free", "pro"]) })

createJob({
    name: "track-account",
    triggers: [/* ... */],
    states: [
        { key: "profile", value: Profile },
        { key: "seenCount", value: z.number() },
    ],
    onTrigger: async (event, state) => {
        const profile = await state.get("profile")        // Profile | undefined
        const count = (await state.get("seenCount")) ?? 0  // number | undefined
        await state.set("seenCount", count + 1)            // only `number` accepted
        // state.set("seenCount", "x")  // type error
        // state.get("nope")            // key not declared
    },
})
```

`states` is your job's own typed state. It is separate from `toolbox.terse.memory({ command })`, the memory the agent reads and edits.

## TerseAgent API

| Goal | TypeScript | Description |
|------|------------|-------------|
| One-shot run (shorthand) | `generateText({ prompt, skills?, toolApprovals?, outputSchema? })` | Top-level shorthand for the common case: one prompt → output, with the model free to call any tool granted via `skills`. Returns a string, or a typed validated object when `outputSchema` is set. See below. |
| Run to completion | `agent.runAndWait(prompt, outputSchema?)` | Use for AI-driven decisions such as summarize, analyze, or triage. Pass a Zod schema for structured output; the returned value is typed and validated. |
| Stream output | `agent.run(prompt, outputSchema?)` | Async iterable of streamed agent events. Same prompt + optional Zod schema. |
| Generated tool wrappers | `agent.tools.<integration>.<method>(params)` | Type-safe direct tool calls generated from connected integrations. Only present for integrations included in the agent's `skills`. |

### `generateText` — shorthand for one-shot runs

`generateText` is a top-level function (overloaded on `outputSchema`) for the common case: a single prompt that runs to completion and returns the result. The model still runs a full agentic loop and can call any tool granted via `skills` — `generateText` just saves you the `TerseAgent.create()` + `runAndWait()` boilerplate when you don't need the agent instance itself.

```typescript
import { generateText } from "terse-sdk"
import { z } from "zod"
import { Skills, AttioObject } from "./terse.generated"

// Free-form text — the model can read/write Attio (Deal) while it works
const summary = await generateText({
    prompt: `Score this account and explain why. ${event.formatForAgentRunner()}`,
    skills: [Skills.attio({ object: AttioObject.Deal })],
})

// Structured output: pass outputSchema, get a typed, validated result
const scored = await generateText({
    prompt: `Score this account and explain why. ${event.formatForAgentRunner()}`,
    skills: [Skills.attio({ object: AttioObject.Deal })],
    outputSchema: z.object({ score: z.number(), rationale: z.string() }),
})
```

`skills` and `toolApprovals` behave exactly as on `TerseAgent.create()`. Use `generateText` for agentic work and `toolbox` for deterministic calls — that covers almost every job. Drop down to `TerseAgent.create()` only for the advanced cases it doesn't expose: streaming partial output with `run()`, or reusing one agent instance across several calls.

Include event context by interpolating `event.formatForAgentRunner()` into the prompt string — there is no separate `event` parameter.

### When to Use What

There are two primitives you reach for in almost every job:

| Approach | Use When |
|----------|----------|
| `generateText({ prompt, skills? })` | **Default for anything agentic.** The model decides what to do — summarize, analyze, choose and call tools (scoped by `skills`) — and you get the final output back. |
| `toolbox.<integration>.<method>(params)` | **Default for anything deterministic.** You know the exact call to make. `toolbox` is unfiltered, needs no agent and no `skills`. |
| Combination | Deterministic setup first (e.g. send a Slack message via `toolbox`), then `generateText` for the part that needs reasoning. |

You only need `TerseAgent.create()` directly for the advanced cases `generateText` doesn't cover: streaming partial output with `run()`, or reusing one agent instance across several calls. Prefer `generateText` + `toolbox` otherwise.

## Triggers

Triggers define what events fire a job. They're all hung off the `Triggers` const that `terse generate` produces in `src/terse.generated.ts`.

```typescript
import { Triggers, Repos, SlackChannel, LinearTeam } from "./terse.generated"
```

### GitHub
```typescript
Triggers.github.onPROpened({ repo: Repos.MyOrg.MyRepo })
Triggers.github.onPRMerged({ repo: Repos.MyOrg.MyRepo })
Triggers.github.onPRClosed({ repo: Repos.MyOrg.MyRepo })
Triggers.github.onPRSynchronized({ repo: Repos.MyOrg.MyRepo })
Triggers.github.onPR({ repo: Repos.MyOrg.MyRepo })             // any PR event
Triggers.github.onPush({ repo: Repos.MyOrg.MyRepo })
Triggers.github.onIssueComment({ repo: Repos.MyOrg.MyRepo })   // comment on issue or PR
```

### Slack
```typescript
Triggers.slack.onMessage({ channel: SlackChannel.General })
Triggers.slack.onAppMention({ channel: SlackChannel.General })
Triggers.slack.onReactionAdded({ channel: SlackChannel.General })
Triggers.slack.onDm()
```

### Linear
```typescript
Triggers.linear.onIssueCreated({ team: LinearTeam.Engineering })
Triggers.linear.onIssueUpdated({ team: LinearTeam.Engineering })
Triggers.linear.onComment({ team: LinearTeam.Engineering })
```

### Gmail
```typescript
Triggers.gmail.onEmail()
```

### WorkOS
```typescript
Triggers.workOS.onUserCreated()
Triggers.workOS.onMembershipCreated()
Triggers.workOS.onInvitationAccepted()
Triggers.workOS.onOrganizationCreated()
```

### Cron / Schedule
```typescript
Triggers.schedule.cron({ expression: "0 9 * * 1" })    // every Monday at 9 AM
Triggers.schedule.cron({ expression: "*/30 * * * *" }) // every 30 minutes
```

### Webhook
```typescript
Triggers.webhook.onRequest<{ payload: string }>()
```

## Skills (Model Access + Typed Wrappers)

Skills are exposed via the `Skills` const generated into `src/terse.generated.ts`. They serve two purposes at once:

1. Scope the integration tools the **model** can pick during `run()` / `runAndWait()`.
2. Gate which integrations appear on the **agent's** `agent.tools.<integration>` wrappers.

`toolbox.<integration>.<method>` is always available regardless of `skills` — use it for deterministic calls when you don't have or need an agent.

```typescript
import { Skills, Repos, SlackChannel, LinearTeam, NotionDatabase,
    PosthogProject, DatadogIndex, LaunchDarklyProject, AttioObject } from "./terse.generated"

skills: [
    Skills.github({ repos: [Repos.MyOrg.MyRepo] }),
    Skills.slack({ channel: SlackChannel.General }),
    Skills.linear({ team: LinearTeam.Engineering }),
    Skills.notion({ databases: [NotionDatabase.Tasks] }),
    Skills.gmail(),
    Skills.gmailDraft(),                                                 // create-draft-only variant
    Skills.posthog({ project: PosthogProject.Main }),
    Skills.datadog({ indexes: [DatadogIndex.Main] }),
    Skills.launchDarkly({ project: LaunchDarklyProject.Default, environmentKeys: ["production"] }),
    Skills.workOS(),
    Skills.attio({ object: AttioObject.Deal }),
    Skills.snowflake(),
    Skills.web(),                                                        // built-in web search / extract / research
    Skills.web({ allowedDomains: ["example.com"] }),                     // restrict search + extract to a whitelist of domains
    Skills.imageEdit(),                                                  // built-in image edit / generate
    Skills.memory(),                                                     // built-in persistent /memories dir, carries over between runs (per project + per job)
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

### GithubIssueCommentCreatedTrigger
```typescript
event.issue.number          // issue or PR number
event.issue.title           // issue or PR title
event.issue.body            // issue or PR body (optional)
event.issue.state           // "open" | "closed"
event.issue.url             // issue or PR URL
event.issue.author          // { login, email? }
event.issue.isPullRequest   // true if the comment is on a PR, false for an issue
event.comment.id            // comment id
event.comment.body          // comment body
event.comment.author        // { login, email? }
event.comment.url           // comment URL
event.comment.createdAt     // ISO timestamp
event.sender                // { login, email? } (who posted the comment)
event.repository            // { id, name, owner, defaultBranch }
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

### Narrowing the event type

`createJob`'s `onTrigger` already infers `event` from the `triggers` array, so you usually don't need to annotate. When you do, use the precise trigger type that matches your factory (e.g. `GithubPROpenedTrigger` for `Triggers.github.onPROpened`, `LinearIssueCreatedTrigger` for `Triggers.linear.onIssueCreated`). There are no runtime type guards in `terse-sdk` — narrow via the annotation.

```typescript
import type { GithubPROpenedTrigger } from "terse-sdk"

onTrigger: async (event: GithubPROpenedTrigger) => { /* event.pullRequest, etc. */ }
```

## Terse CLI

The authoritative reference for every command and flag lives at https://docs.useterse.ai/reference/cli — pull it whenever you need details. Quick summary:

| Command | Description |
|---------|-------------|
| `terse init [name]` | Scaffold a new project. Use `--non-interactive` (or `-y`) for non-interactive setup when authentication is already available. |
| `terse attach` | Add Terse to an existing project. Use `--non-interactive` (or `-y`) for non-interactive attach flows. |
| `terse auth login` / `terse auth logout` / `terse auth status` | Manage CLI credentials. The active organization can be switched with `terse auth org switch`. |
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
terse generate           # if src/terse.generated.ts is not already present
# read src/terse.generated.ts for connected integrations, triggers, and skills
# edit src/terse.jobs.ts
terse test list "my-job" --json
terse test show <id> "my-job" --json
terse test run "my-job" --id <id>
terse deploy
```

When the target directory is brand-new, missing `package.json`, `tsconfig.json`, and `src/terse.generated.ts` is expected before `terse init`.

### Existing Project Agent-Friendly Workflow
```bash
# read src/terse.generated.ts for connected integrations, triggers, and skills
# run terse generate if the file is missing or stale
# edit src/terse.jobs.ts
terse test list "my-job" --json
terse test show <id> "my-job" --json
terse test run "my-job" --id <id>
terse deploy
```
