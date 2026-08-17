# Terse Job Code Conventions

These conventions govern every line of job code you write or modify in a project's job files (`src/terse.jobs.ts` and `src/jobs/`). Precedence: live Terse docs win on facts (API signatures, CLI flags, availability); this file wins on style.

Overrides the user gives in the session win over this file.

## Type discipline

**Type everything; rarely cast.** Reach for `as` or `any` almost never. A cast usually means the approach is wrong: refactor at a higher level, fix how the third-party dependency is wrapped, or ask the user what to do. Prefer type guards, generics, and `satisfies`.

**Zod at trust boundaries.** A zod schema (with `z.infer` for the static type) is required exactly where data crosses a boundary you don't control:

- responses from external APIs not typed by an official SDK
- webhook trigger payloads
- `jobStep` `inputSchema` / `outputSchema`
- `generateText` `outputSchema`

Internal shapes you construct yourself stay plain types. Official SDK types are trusted as-is; don't re-validate them at runtime.

Derive the static type from the schema so there is one source of truth:

```typescript
const Classification = z.object({
    severity: z.enum(["critical", "routine"]),
    reason: z.string(),
})
type Classification = z.infer<typeof Classification>
```

**Explicit return types.** Every function declaration and named arrow function gets an explicit return type, helpers included. Inline callbacks — `map`/`filter` lambdas, the `filter` and `onTrigger` functions passed inline to `createJob` — stay inferred.

**Discovered values are typed constants.** Values discovered by probing external state (an audience ID, a verified domain, a channel ID) land as named constants with explicit types, never as bare string literals inline in a call. Use the SDK's type when it has one, otherwise a narrow alias:

```typescript
const WAITLIST_AUDIENCE_ID: AudienceId = "78261eea-8f8b-4381-83c6-79fa7120f1cf"

type AudienceId = string
```

## Control flow

**Exhaustive discriminated unions.** Dispatch on the discriminant with a `switch`, and end the `default` with `throw x satisfies never`. Never dispatch with inline ternaries.

```typescript
switch (classification.severity) {
    case "critical":
        return escalateCritical(event, classification)
    case "routine":
        return fileRoutine(event, classification)
    default:
        throw classification.severity satisfies never
}
```

**No nested try/catch.** When a `catch` body needs its own error handling, extract the catch body into a helper function and call it from the `catch`.

**Time comes from the event.** Derive dates and windows from `event.triggeredAt`, never `Date.now()` or `new Date()`, which drift across queue delay, retries, and replays. Window math is plain synchronous code; it needs no step or helper.

**Functional iteration.** Prefer `map`/`filter`/`reduce` for transforms and `forEach` for synchronous side effects; reach for `for` loops sparingly. When the loop body awaits, use `Promise.all(items.map(...))` for parallel work or `for...of` for sequential awaits — never pass an async callback to `forEach`, which fires without awaiting and swallows rejections.

**Async/await over `.then`.** Use `async`/`await` and the Promise combinators (`Promise.all`, `Promise.allSettled`, `Promise.race`) instead of `.then()` chains.

**Errors are custom classes** that `extend Error` and set `this.name`:

```typescript
class MissingSecretError extends Error {
    constructor(secretName: string) {
        super(`Missing required secret: ${secretName}. Add it with \`terse secrets add ${secretName}\`.`)
        this.name = "MissingSecretError"
    }
}
```

**Fail on fabricated absence.** When a contract implies a value exists — the SDK call's error was already handled, the schema marks the field required — do not smuggle absence through as data with `?.` or `?? null`; throw a custom error naming the violated invariant. Absence that is a legitimate domain state (a lookup miss, a genuinely optional field) is fine, but model it explicitly: type it `| null` so every caller branches.

```typescript
const { data, error } = await resend.emails.send({ from, to, subject, html })
if (error) throw new ResendApiError("emails.send", error.message)
if (!data) throw new ResendApiError("emails.send", "no data in response")
return { emailId: data.id }
```

## File shape

**Stepdown rule.** High-level logic at the top (`createJob` and its `onTrigger`), helper functions underneath, so the file reads like a newspaper article: big picture first, details later.

**Types, interfaces, and zod schemas go at the bottom of the file**, below the implementation. Schemas referenced from handlers and helpers are only read when the job runs, so bottom placement is safe.

**Minimize comments.** Add one only when a choice is non-obvious, odd, or a deliberate compromise.

## Project layout

**One file per job, always.** Every job lives in its own file in `src/jobs/`, named in kebab-case after the job (`src/jobs/triage-bug-reports.ts`), and `src/terse.jobs.ts` is a pure manifest of side-effect imports — even when the project has a single job:

```typescript
import "./jobs/triage-bug-reports"
import "./jobs/weekly-digest"
```

`createJob()` registers by side effect, so a job file never imported from the entry file silently never runs or deploys. Every file in `src/jobs/` must have a matching import line in the manifest.

Job files import generated helpers via `../terse.generated`. Pure, step-free helpers shared by several jobs may live in a shared module; a helper containing steps stays in its job's file (see "Branches become helpers" below), duplicated across job files when two jobs need it.

## Libraries

**Prefer a library over building it yourself** for common problems (retries, date math, parsing, validation). Pick popular, well-maintained ones; check downloads and recent releases before adopting.

## Integrating with a platform

Work down this ladder and stop at the first rung that can do the job:

1. **Built-in Terse integration, already connected** — anything in `src/terse.generated.ts` and its `terse.generated/` folder (`toolbox.*`, `Skills.*`, `Triggers.*`).
2. **Built-in integration type, not yet connected** — connect it with `terse integrate connect`, then rerun `terse generate`.
3. **No built-in integration** — use the platform's official TypeScript SDK, after validating it is official: published under the vendor's npm org or linked from the vendor's official developer docs / GitHub org (e.g. `@slack/web-api`, `octokit`, `@linear/sdk`, `stripe`). Lean on its built-in types.
4. **No official SDK** — research the leading community wrapper and present the user a choice between:
   - the community wrapper, with concrete evidence: GitHub stars, years maintained, date of last release, weekly npm downloads, maintainer reputation
   - a hand-rolled typed fetch client with zod schemas at the response boundary, built from the platform's REST API docs

   Never adopt a community wrapper silently.

**Credentials** for anything past rung 2 go through project secrets: store with `terse secrets add <NAME>`, read `process.env.<NAME>` at the top of the job, and fail fast with a custom error when missing.

Scalar credentials (API keys, tokens) are stored as-is. File-shaped credentials — a Google service account JSON, a PEM key, anything multiline — are stored base64-encoded under a `_B64`-suffixed name, never pasted raw: raw JSON mangles the interactive prompt and turns shell quoting into a minefield, while base64 makes the value one safe token. Ask the user for the file's path and encode straight from the file, so the plaintext never appears in the conversation:

```bash
base64 -i service-account.json | terse secrets add GOOGLE_SERVICE_ACCOUNT_B64 --value-stdin
```

(On GNU coreutils, add `-w 0` to disable line wrapping.)

Decode at the top of the job, validating the fields the job uses at the boundary:

```typescript
const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_B64
if (!encoded) throw new MissingSecretError("GOOGLE_SERVICE_ACCOUNT_B64")
const parsed = serviceAccountSchema.safeParse(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")))
if (!parsed.success) throw new InvalidSecretError("GOOGLE_SERVICE_ACCOUNT_B64", parsed.error)
```

For `_B64` secrets, put the full encode one-liner in the missing-secret error message so the fix is copy-pasteable.

## Durable job style

These rules apply when the job sets `durable: true`. The mechanics (replay model, `step()`, `jobStep`, `sleep`, `waitForInput`) live in https://docs.useterse.ai/core-concepts/durability; facts there win.

**When to be durable.** Two kinds of signal, treated differently:

- **Forcing signals** — human input or approval (`waitForInput`) or timed waits (`sleep`). These primitives only exist in durable mode, so their presence *requires* `durable: true`; there is no decision to put to the user, only a consequence to state.
- **Judgment signal** — three or more side-effecting stages where a mid-run failure would leave visible half-done work. This is a genuine trade-off: recommend `durable: true` and let the user decide.

With neither signal, default to non-durable.

**`step()` inline is the default.** Wrap each external call directly — `await step(client.method(args))` — so the handler reads as sequential blocks. Terse SDK calls (`toolbox.*`, `generateText`, `state.get`/`state.set`) are already durable steps; leave them bare.

**Only data crosses the step boundary.** Arguments and resolved values are journaled, so they must be serializable: no closures, callbacks, streams, or live objects. The callee must live at module scope. For a multi-call unit or a callback-taking API, write a module-scope function and wrap the call to it: `await step(sendWithRetry(args))`.

**`jobStep({ inputSchema, outputSchema, run })` is reserved for trust boundaries** — when the values crossing the durability boundary need runtime validation — or for a block that must journal as one unit and can't be expressed as a module-scope function call.

**Branches become helpers.** A conditional path is extracted into a named helper function exactly when it contains steps (`step()`, `jobStep`, `toolbox.*`, `generateText`, `sleep`, `waitForInput`). Pure value-computing conditionals stay inline. Helpers sit below the job in the same file: `step()` is only transformed in files that call `createJob()`, so moving a helper to another file silently breaks it. The payoff is a handler you can read top-down, opening each branch only when you care about it.

**Branch on journaled data.** Conditions that pick a branch must derive from the trigger event or step results, so every replay takes the same path.

**Code outside steps re-runs on every replay.** Keep it pure and cheap; every side effect lives inside a step. A bare `console.log` outside a step prints once per replay; use `await log(...)` from `terse-sdk` (a journaled step) for lines that should print once.

## Worked examples

Method and constant names in both examples come from your project's generated files; never invent them.

### Durable

The job below shows the target durable shape: the handler at the top reading as sequential blocks, an exhaustive switch dispatching to side-effecting branch helpers, schemas and types at the bottom.

```typescript
import { createJob, generateText, slack, sleep, waitForInput } from "terse-sdk"
import { z } from "zod"
import { Triggers, LinearTeam, SlackChannel, toolbox, type LinearIssueCreatedTrigger } from "./terse.generated"

createJob({
    name: "Triage inbound bug reports",
    triggers: [Triggers.linear.onIssueCreated({ team: LinearTeam.Support })],
    durable: true,
    filter: async event => !event.issue.title.startsWith("[test]"),
    onTrigger: async event => {
        const classification = await generateText({
            prompt:
                `Classify this bug report as critical (data loss, security, outage) or routine. ` +
                `Explain your reasoning in one sentence. Context: ${event.formatForAgentRunner()}`,
            skills: [],
            outputSchema: Classification,
        })

        switch (classification.severity) {
            case "critical":
                return escalateCritical(event, classification)
            case "routine":
                return fileRoutine(event, classification)
            default:
                throw classification.severity satisfies never
        }
    },
})

async function escalateCritical(event: LinearIssueCreatedTrigger, classification: Classification): Promise<void> {
    await toolbox.slack.sendMessage({
        channelId: SlackChannel.OnCall.channelId,
        message: `Critical bug: ${event.issue.title} — ${classification.reason}`,
        thread_ts: "",
        blocks: "",
    })
    const approval = await waitForInput({
        via: slack({ channel: SlackChannel.OnCall.channelId }),
        prompt: "Page the on-call engineer?",
        details: { issue: event.issue.title, reason: classification.reason },
        options: [
            { id: "page", label: "Page now" },
            { id: "hold", label: "Hold until morning" },
        ],
    })
    if (approval.choice === "hold") {
        await sleep("8h")
    }
    await toolbox.linear.updateIssue({ issueId: event.issue.id, priority: 1 })
}

async function fileRoutine(event: LinearIssueCreatedTrigger, classification: Classification): Promise<void> {
    await toolbox.linear.createComment({
        issueId: event.issue.id,
        body: `Auto-triaged as routine: ${classification.reason}`,
    })
}

const Classification = z.object({
    severity: z.enum(["critical", "routine"]),
    reason: z.string(),
})
type Classification = z.infer<typeof Classification>
```

### Non-durable

A complete non-durable job: deterministic post, agentic summary, deterministic threaded reply.

```typescript
import { createJob, generateText } from "terse-sdk"
import { Triggers, Skills, Repos, SlackChannel, toolbox, type GithubPROpenedTrigger } from "./terse.generated"

createJob({
    name: "Summarize PR and notify Slack",
    triggers: [Triggers.github.onPROpened({ repo: Repos.MyOrg.MyRepo })],
    filter: async (event: GithubPROpenedTrigger) => {
        return !event.sender.login.includes("[bot]")
    },
    onTrigger: async (event: GithubPROpenedTrigger) => {
        // Deterministic: fixed channel, fixed opener — use toolbox, no agent needed
        const message = await toolbox.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
            thread_ts: "",
            blocks: "",
        })

        // Agentic: only the summary needs judgment
        const summary = await generateText({
            prompt:
                `Summarize the changes in this PR. ` +
                `Focus on what changed, why it matters, and what reviewers should look at first. ` +
                `Keep it concise. Context: ${event.formatForAgentRunner()}`,
            skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
        })

        // Deterministic: post the result back in thread
        await toolbox.slack.sendMessage({
            channelId: SlackChannel.Engineering.channelId,
            message: summary,
            thread_ts: message.message_ts,
            blocks: "",
        })
    },
})
```
