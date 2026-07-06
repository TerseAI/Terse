# Terse Job Code Conventions

These conventions govern every line of job code you write or modify in `src/terse.jobs.ts`. Precedence: live Terse docs win on facts (API signatures, CLI flags, availability); this file wins on style.

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

**Errors are custom classes** that `extend Error` and set `this.name`:

```typescript
class MissingSecretError extends Error {
    constructor(secretName: string) {
        super(`Missing required secret: ${secretName}. Add it with \`terse secrets add ${secretName}\`.`)
        this.name = "MissingSecretError"
    }
}
```

## File shape

**Stepdown rule.** High-level logic at the top (`createJob` and its `onTrigger`), helper functions underneath, so the file reads like a newspaper article: big picture first, details later.

**Types, interfaces, and zod schemas go at the bottom of the file**, below the implementation. Schemas referenced from handlers and helpers are only read when the job runs, so bottom placement is safe.

**Minimize comments.** Add one only when a choice is non-obvious, odd, or a deliberate compromise.

## Libraries

**Prefer a library over building it yourself** for common problems (retries, date math, parsing, validation). Pick popular, well-maintained ones; check downloads and recent releases before adopting.

## Integrating with a platform

Work down this ladder and stop at the first rung that can do the job:

1. **Built-in Terse integration, already connected** — anything in `src/terse.generated.ts` (`toolbox.*`, `Skills.*`, `Triggers.*`).
2. **Built-in integration type, not yet connected** — connect it with `terse integrate connect`, then rerun `terse generate`.
3. **No built-in integration** — use the platform's official TypeScript SDK, after validating it is official: published under the vendor's npm org or linked from the vendor's official developer docs / GitHub org (e.g. `@slack/web-api`, `octokit`, `@linear/sdk`, `stripe`). Lean on its built-in types.
4. **No official SDK** — research the leading community wrapper and present the user a choice between:
   - the community wrapper, with concrete evidence: GitHub stars, years maintained, date of last release, weekly npm downloads, maintainer reputation
   - a hand-rolled typed fetch client with zod schemas at the response boundary, built from the platform's REST API docs

   Never adopt a community wrapper silently.

**Credentials** for anything past rung 2 go through project secrets: store with `terse secrets add <NAME>`, read `process.env.<NAME>` at the top of the job, and fail fast with a custom error when missing.

## Durable job style

These rules apply when the job sets `durable: true`. The mechanics (replay model, `step()`, `jobStep`, `sleep`, `waitForInput`) live in the sdk-reference and https://docs.useterse.ai/core-concepts/durability; facts there win.

**`step()` inline is the default.** Wrap each external call directly — `await step(client.method(args))` — so the handler reads as sequential blocks. Terse SDK calls (`toolbox.*`, `generateText`, `state.get`/`state.set`) are already durable steps; leave them bare.

**Only data crosses the step boundary.** Arguments and resolved values are journaled, so they must be serializable: no closures, callbacks, streams, or live objects. The callee must live at module scope. For a multi-call unit or a callback-taking API, write a module-scope function and wrap the call to it: `await step(sendWithRetry(args))`.

**`jobStep({ inputSchema, outputSchema, run })` is reserved for trust boundaries** — when the values crossing the durability boundary need runtime validation — or for a block that must journal as one unit and can't be expressed as a module-scope function call.

**Branches become helpers.** A conditional path is extracted into a named helper function exactly when it contains steps (`step()`, `jobStep`, `toolbox.*`, `generateText`, `sleep`, `waitForInput`). Pure value-computing conditionals stay inline. Helpers sit below the job in the same file: `step()` is only transformed in files that call `createJob()`, so moving a helper to another file silently breaks it. The payoff is a handler you can read top-down, opening each branch only when you care about it.

**Branch on journaled data.** Conditions that pick a branch must derive from the trigger event or step results, so every replay takes the same path.

**Code outside steps re-runs on every replay.** Keep it pure and cheap; every side effect lives inside a step.

## Worked example

The job below shows the target shape: the handler at the top reading as sequential blocks, an exhaustive switch dispatching to side-effecting branch helpers, schemas and types at the bottom. Method and constant names come from your project's `src/terse.generated.ts`; never invent them.

It was built milestone by milestone, each proven green (`tsc --noEmit` passes, `terse test run` on the pinned sample event completes, agentic output inspected) before the next began:

- **Milestone 0** — trigger + filter + a stub handler logging the event
- **Milestone 1** — classify the issue (`generateText` with `outputSchema`)
- **Milestone 2** — the routine branch (`fileRoutine`)
- **Milestone 3** — the critical branch with approval and wait (`escalateCritical`)

```typescript
import { createJob, generateText, slack, sleep, waitForInput } from "terse-sdk"
import type { LinearIssueCreatedTrigger } from "terse-sdk"
import { z } from "zod"
import { Triggers, LinearTeam, SlackChannel, toolbox } from "./terse.generated"

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

async function escalateCritical(event: LinearIssueCreatedTrigger, classification: Classification) {
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

async function fileRoutine(event: LinearIssueCreatedTrigger, classification: Classification) {
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
