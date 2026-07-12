---
name: terse-improve
description: Improve an existing Terse workflow. Use when the user wants to fix, speed up, or refactor an automation already built on Terse, or asks why a deployed job misbehaved. Diagnoses from production run history and verifies with replay.
license: MIT
metadata:
  author: Terse AI
  version: "0.4.0"
  category: workflow
---

<!-- Generated from templates/terse-improve.md.hbs by scripts/build-skills.mjs. Edit the template, not this file. -->

# Improve a Terse Workflow

Improve the Terse workflow named: **$ARGUMENTS**

A workflow is defined in code as a job (`createJob` in `src/terse.jobs.ts`); the CLI commands below take that job name.

## Reference docs

Terse evolves fast; the live docs are the source of truth for facts:

- Doc index: https://docs.useterse.ai/llms.txt — fetch this first to discover every page available, then pull the specific pages you need (triggers, skills, hosting, observability, etc.).
- CLI reference: https://docs.useterse.ai/reference/cli — authoritative source for every `terse` command, including `history`, `replay`, and `test`.

Precedence: live docs win on facts (API signatures, CLI flags, availability). The "Terse Job Code Conventions" section at the bottom of this file wins on style — how job code is structured — and the "Testing Safety Conventions" section wins on how test runs, replays, and ad-hoc tool calls are conducted.

## Steps

**Do not search or read `node_modules/`.** Everything you need is in `src/terse.jobs.ts`, `src/jobs/`, `src/terse.generated.ts`, the bundled references, and live Terse docs — not inside dependency install dirs.

`src/terse.generated.ts` is the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. The comment at the top of the file lists every integration currently available in Terse — never plan around an integration that is not in that list. Read it alongside the job implementation. Do not run `terse integrate list` — the generated file already reflects what `terse integrate` connected or what is available to connect in this workspace. For what an available integration can do, `terse integrate tool <type> --json` lists its tools with descriptions, and `terse integrate tool <type> <tool-name> --json` returns one tool's input/output schemas. To see what a tool actually returns, `terse integrate tool run <tool> --params '<json>'` runs it one-shot — see "Testing tool calls from the CLI" in the testing conventions.

If `src/terse.generated.ts` is missing or stale for the integrations the job uses, rerun `terse generate` instead of guessing at missing helpers. Never edit the generated file directly.

**Narrate the run.** Speak to the user in casual first person about the work itself: "I'm pulling production history to see what actually went wrong", "the replay passes now with the new filter". At every phase transition, name the phase in plain casual words with its place in the sequence — diagnose, analyze, implement, verify — "Diagnosis is done — that's 1 of 4. Next I'll comb the job for improvements." Never speak internal step numbers; the user should always know where the work stands from the prose alone.

**Mark every CLI run.** The `terse` CLI doing something is an event the user must be able to see; harnesses often collapse tool calls, so the narration carries it. Immediately before each `terse` command, emit a marker line:

> ⏵ `terse replay 01hq3v…` — re-running the failed production event against the fix

One marker per command: the command verbatim in backticks, then the why in a few words. Back-to-back cheap reads (`terse test list`, `terse test show`) may share a single marker. When a state-changing or long-running command finishes (`generate`, `deploy`, `replay`, `test run`), report its outcome in the normal narration voice. Never bury a `terse` invocation inside a pipeline, subshell, or script where the user can't see it ran.

**Explain every test before it runs.** A marker line is not enough for `terse replay` or `terse test run`: immediately before one, say in one to three casual sentences what the run exercises, why now, and what a good result looks like — "This replay re-runs the exact production event that failed on Tuesday; with the new filter I expect it to skip the bot comment instead of crashing." When it finishes, give the verdict against that stated expectation in the same voice. Cheap reads (`terse test list`, `terse test show`) keep just the marker.

### 1. Find the workflow

Open `src/terse.jobs.ts` and `src/terse.generated.ts`. If the entry file is a manifest of side-effect imports, follow them into `src/jobs/`. Find the job matching the requested workflow name and read the full implementation — triggers, skills, filter, and handler.

The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

### 2. Pull production run history

Before guessing at improvements, look at how the job has actually behaved in production. The `terse history` CLI command fetches past runs from the deployed agent so you can see what went wrong.

Recommended invocations (see https://docs.useterse.ai/reference/cli for the full flag list):

```bash
# Recent runs as JSON, with the trigger event payload for each one (cheap, ideal for this skill)
terse history "<job-name>" --json --triggers --limit 20

# Narrow to failures only
terse history "<job-name>" --json --triggers --status failed,cancelled --limit 20

# Full chat history (model events + trigger event) for a single run — heavier, use when you need to see exactly what the agent decided
terse history --run-id <run-id> --json
```

If a JSON-mode command returns a structured `{ "error": ... }` envelope with `actionRequired: true`, or exits with code `2`, stop and surface the required next step or URL instead of treating it as a code bug.

What to look for:

- **Failed or cancelled runs** — the trigger event shows the input that broke the job.
- **Repeated patterns** — the same kind of event misbehaving suggests a missing filter, a vague prompt, or a missing skill.
- **Wasted runs** — bot events, drafts, or no-op events that should have been filtered out.
- **Agentic overreach** — `generateText` doing deterministic work (`toolbox` would be correct). Check chat history for wrong tool picks or hallucinated parameters.

If the user has not deployed the job yet (no agent found), skip this step and rely on the source code plus sample events from `terse test list`.

### 3. Analyze for improvements

Account for every area below before you finish: for each, either make a change or confirm it's already fine. Don't stop at the first easy win. Start with **Tool usage**, since moving work from the agent to `toolbox` is usually the highest-impact fix.

The "Terse Job Code Conventions" section at the bottom of this file is what the Conventions and Durability areas audit against. For before/after shapes of the most common fixes, see the "Common Improvement Patterns" section, also below.

#### Tool Usage

- **Known calls vs judgment**: For actions with known parameters, use `toolbox`, not `generateText`. Read available methods in `src/terse.generated.ts`.
- **Unnecessary agents**: If the handler only runs deterministic tools, drop `generateText` entirely and call `toolbox` directly.
- **Prompts doing integration work**: Phrases like "post to Slack", "create a Linear issue", or "add label X" in a prompt usually mean that step should be code. Keep prompts for judgment only (summarize, triage, draft).
- **Skill scoping**: `skills` controls what tools the model can pick during a `generateText` run. `toolbox.<integration>` is unaffected by `skills` — use it when you want a deterministic call without configuring an agent.
- **Multi-step**: Known setup first (`toolbox.slack.sendMessage`), then a narrow `generateText` call for the part that needs judgment, then post the result back with `toolbox`.
- **Tool results**: Capture return values from deterministic calls when later steps need them (e.g. `message.message_ts` for threading).

#### Prompt Quality

- **Specificity**: Does the prompt tell the agent exactly what to do? Vague prompts like "handle this event" waste tokens and produce inconsistent results. Be specific: "Summarize the PR changes in 3 bullet points and post to Slack."
- **Event context**: Does it include the full event payload via `event.formatForAgentRunner()`?
- **Edge cases**: Does the prompt explain what to do when things are ambiguous? E.g., "If the PR has no description, summarize from the diff only."
- **Format instructions**: Does it specify the output format? "Format as Block Kit JSON" vs leaving it open.
- **Length**: Is the prompt too long? Split multi-step instructions into separate agent runs or use deterministic tool calls for the predictable parts.

#### Event Filtering

- **Bot events**: Should bot-generated events be skipped? (`event.sender.login.includes("[bot]")`)
- **Draft/WIP**: Should draft PRs or WIP items be ignored?
- **Specific sources**: Should events from certain users, repos, or channels be filtered?
- **Cost**: Every unfiltered event triggers an agent run. Filters save real money.

#### Error Handling

- **Missing data**: Does the code handle cases where event data might be missing? (e.g., PR with no body, push with no commits) Fail fast with a custom error rather than limping on.
- **Prompt resilience**: Does the agent prompt explain what to do if a tool call fails?

#### Conventions

- Audit the job against every rule in the conventions section; it is the checklist.
- Report every violation you find. Fix only the ones on code paths you are already changing for this improvement; offer standalone style retrofits as an explicit opt-in. For the one-file-per-job layout violation this means splitting out only the job(s) you are already touching, leaving the rest inline and flagged.

#### Durability

- **Durable jobs**: audit the handler against the "Durable job style" rules in the conventions section — step placement, serializable boundaries, branch helpers, journaled branch conditions.
- **Non-durable jobs**: check for the durable signals in the conventions section ("When to be durable") that have crept in. A forcing signal (`waitForInput`, `sleep`) means the job is broken, not improvable — the flip to `durable: true` (and the step restructuring it requires) is a required fix; state it as a consequence, never as a question. The judgment signal (three or more side-effecting milestones) makes the flip an opt-in improvement to recommend.

#### Skill Configuration

- **Missing skills**: Are all integrations the model needs during a `generateText` run listed? If the prompt tells the model to post to Slack but Slack isn't in `skills`, that agentic step will fail.
- **Unnecessary skills**: Are there skills the agent doesn't actually use? Remove them to reduce confusion.
- **Scope**: Are repos/channels/teams scoped correctly? Too broad gives the agent access to things it shouldn't touch. Too narrow prevents it from doing its job.

### 4. Confirm behavior changes with the user

If any proposed improvement changes the job's observable behavior — a filter that skips events it used to process, a rewritten prompt, a changed output surface, a judgment-signal durability flip — put those decisions to the user before implementing. Provide a recommended answer for each, and batch related questions, at most four per interruption. Mechanical fixes (typing, error classes, file shape) and forced durability flips don't need confirmation.

If a *fact* can be found in the code, run history, or docs, look it up rather than asking. If you are running headless with no one to answer, take your recommended answers and state them with reasons in the final summary.

### 5. Implement improvements

Edit the job's file — `src/terse.jobs.ts` in a single-job project, its `src/jobs/<name>.ts` file under the manifest layout, or the repo's configured `--entry-file`. Make the changes following the conventions section.

If an improvement needs a new integration, describe before connecting: `terse integrate describe <type> --json` returns the `installationType` (form or OAuth) and, for form installs, the exact fields `connect` requires — never guess field names. Form installs take values via `--field key=value` with secrets on `--fields-stdin`; OAuth installs open a browser and exit 2 with a handoff, so tell the user first and follow with `terse integrate wait <type>`.

After connecting a new integration or when you need updated helpers, rerun `terse generate` and reopen `src/terse.generated.ts` — never edit the generated file by hand.

### 6. Verify the changes locally

Don't hand the change back without proving it still works.

Replays and test runs execute the real handler with real credentials, against real production events. Before the first local run of a job that writes to an external surface, follow the "Testing Safety Conventions" section at the bottom of this file: point writes at test targets or a test-mode key, and ask the user before writing to any production surface.

Two complementary loops:

**Replay the exact production run that failed.** If you used `terse history` in step 2 to find a bad run, replay it locally with the new code:

```bash
terse replay <run-id>
```

`terse replay` fetches the original serialized trigger event from the Terse backend and runs your job's `onTrigger` against it locally with verbose agent output. This is the fastest way to confirm the bug you saw in production is actually fixed.

**Or run against fresh sample events non-interactively.** When there is no specific run to reproduce, or to make sure you didn't regress the happy path:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

`terse test list` pulls real sample events from the backend (or generates synthetic ones for cron and webhook triggers) and assigns content-addressed ids.
`terse test show` lets you inspect a specific cached sample before running it.
`terse test run` executes the handler without requiring a TTY.

If multiple jobs exist, pass the job name explicitly because non-interactive job loading cannot prompt.
Reserve bare `terse test` for manual interactive sessions only.

To replay a specific payload, or when no sample events are available, hand-write an event file and run it with `terse test run --event-file <path>`: on a shape mismatch, the command prints the expected envelope and the exact validation issues — correct the file from that error output rather than guessing fields.

For all of these commands, see https://docs.useterse.ai/reference/cli for the full option list.

### 7. Typecheck the project

After local execution looks healthy, run the typechecker so the change is statically valid before deploy:

```bash
pnpm exec tsc --noEmit
```

Use `npx tsc --noEmit` or `pnpm run build` if that matches how the project is set up. Fix any errors before reporting back.

### 8. Explain changes

After implementing and verifying, summarize what you changed and why. Where it helps, cite the production runs from `terse history` that motivated each change and note which `terse replay` / `terse test list/show/run` invocations confirmed the fix.

### 9. Ask before deploying

Do not run `terse deploy` automatically. After explaining the changes, ask the user whether to deploy them now.

If you changed the step structure of a deployed **durable** job (added, removed, or reordered steps), warn the user in the same ask: in-flight runs will resume against a changed journal and can fail or misbehave, so deploy at a quiet moment.

Example prompt:

> The improvements are verified locally. Deploy to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

---

# Common Improvement Patterns

Before/after shapes for the fixes the analysis pass most often lands on. Method and constant names come from the project's `src/terse.generated.ts`; never invent them.

## Add bot filtering

```typescript
// BEFORE: runs on every event
onTrigger: async (event) => { ... }

// AFTER: skip bot events
filter: async (event: GithubPRTrigger) => {
    return !event.sender.login.includes("[bot]") && !event.pullRequest.merged
},
onTrigger: async (event: GithubPRTrigger) => { ... }
```

## Improve prompt specificity

```typescript
// BEFORE: vague
await generateText({ prompt: `Review this PR: ${event.formatForAgentRunner()}`, skills: [...] })

// AFTER: specific instructions, format, edge cases
await generateText({
    prompt:
        `Review PR "${event.pullRequest.title}" (${event.pullRequest.url}). ` +
        `Look at the diff and leave a concise review comment. ` +
        `Focus on: correctness, edge cases, and naming. ` +
        `Skip style nits. If the PR looks good, approve it with a short note. ` +
        `Context: ${event.formatForAgentRunner()}`,
    skills: [...],
})
```

## Split deterministic + AI actions

```typescript
// BEFORE: agent decides everything including the message send
await generateText({ prompt: `Send a welcome message and summarize: ${event.formatForAgentRunner()}`, skills: [...] })

// AFTER: deterministic send via toolbox (no skill needed), then AI analysis in thread
import { generateText } from "terse-sdk"
import { toolbox } from "./terse.generated"

const message = await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: `New PR from ${event.sender.login}: ${event.pullRequest.title}`,
    thread_ts: "",
    blocks: "",
})

const summary = await generateText({
    prompt: `Summarize the changes in this PR. Context: ${event.formatForAgentRunner()}`,
    skills: [Skills.github({ repos: [Repos.MyOrg.MyRepo] })],
})

await toolbox.slack.sendMessage({
    channelId: SlackChannel.Engineering.channelId,
    message: summary,
    thread_ts: message.message_ts,
    blocks: "",
})
```

## Add type safety

```typescript
// BEFORE: untyped event
onTrigger: async (event) => {
    await generateText({ prompt: `Handle: ${event.formatForAgentRunner()}`, skills: [...] })
}

// AFTER: annotate with the precise trigger type that matches your trigger factory.
// `Triggers.github.onPROpened(...)` returns a typed trigger, so `event` infers
// as `GithubPROpenedTrigger` — annotating just makes it explicit.
import { GithubPROpenedTrigger, generateText } from "terse-sdk"

onTrigger: async (event: GithubPROpenedTrigger) => {
    const { title, url } = event.pullRequest
    await generateText({
        prompt: `Review PR "${title}" at ${url}. Context: ${event.formatForAgentRunner()}`,
        skills: [...],
    })
}
```

---

# Testing Safety Conventions

These conventions govern every local execution of a job — `terse test run`, `terse replay`, and ad-hoc tool calls (`terse integrate tool run`). Local runs execute the real handler with real credentials: nothing about a test run is sandboxed unless you point it somewhere safe.

## Real events in, test targets out

Sample events (`terse test list`, `terse replay`) are real production data; using them as *inputs* is the point — realistic payloads catch real bugs. The line is side effects: a test run must never land writes on real people or real surfaces. Emails, messages, ticket updates, CRM writes — during test runs these go to the test targets the user named, never to the customer, channel, or record in the event.

The one sanctioned exception is the single verification run after swapping to real targets, announced to the user before it fires.

## Test API keys

When the work touches an external API that bills or has customer-visible effects (Stripe, Resend, …), ask the user once — fold it into the test-targets question — whether the platform has a test or sandbox key: "Does this have a test-mode key I should use while building? If so, add it with `terse secrets add <NAME>`." Use the test key for every local run; swapping to the live secret is part of the final swap to real targets.

Secret values are write-only: never try to read a stored secret to check whether it is a test or live key. Discovery is by asking, not inspecting.

## No test key: reads are free, writes ask first

Without a test key, local runs share credentials with production:

- **Reads never need permission.** Listing, fetching, and querying production data during a test run is always fine.
- **Writes ask per surface.** Before the first local run that writes to a production surface (a real repo, a live audience, a customer record), ask the user explicitly about that surface. One ask covers later runs against the same surface; a new surface is a new ask.

## Testing tool calls from the CLI

To learn what an external API returns — the shape of a record, the options a status field takes, which channels exist — run the tool from the CLI:

```
terse integrate tool run slack.listChannels
terse integrate tool run attio.records --params '{"request":{"action":"query","objectSlug":"deals","filter":null,"limit":5,"offset":null}}'
```

- Name the tool by wire name (`attio_records`) or dotted form (`attio.records`); a wrong name errors with the list of valid ones.
- `--params` takes the tool's wire-shape JSON — the exact input schema `terse integrate tool <type> <tool-name> --json` prints. Read that schema, not the generated `toolbox.*` signatures, which can differ from the wire shape. Pipe large params on stdin instead of `--params`.
- The connection is auto-resolved when the workspace has one; with several, the error lists their IDs — retry with `--integration <id>`.
- The result prints as raw JSON on stdout; failures exit nonzero with the error on stderr.

Keep discovery runs read-only: query, list, get. Writes belong in the job, governed by the sections above.

For an API with no toolbox tools, where the call needs hydrated secrets, run the reads inside the existing job:

1. Insert one contiguous block at the top of the job's handler that does the reads, logs the results, and ends with `return` — nothing below it executes.
2. Run it with `terse test run`, so secrets hydrate exactly as they do for real jobs.
3. Record what it found, then delete the block and confirm with `git diff` that the handler is byte-for-byte back to its previous state.

Never create a separate throwaway job for this, and never deploy while the block is in place — `terse deploy` syncs every job in the project.

What discovery finds lands in job code as named, explicitly typed constants — see "Discovered values are typed constants" in the code conventions.

---

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

1. **Built-in Terse integration, already connected** — anything in `src/terse.generated.ts` (`toolbox.*`, `Skills.*`, `Triggers.*`).
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
- **Judgment signal** — three or more side-effecting milestones where a mid-run failure would leave visible half-done work. This is a genuine trade-off: recommend `durable: true` and let the user decide.

With neither signal, default to non-durable.

**`step()` inline is the default.** Wrap each external call directly — `await step(client.method(args))` — so the handler reads as sequential blocks. Terse SDK calls (`toolbox.*`, `generateText`, `state.get`/`state.set`) are already durable steps; leave them bare.

**Only data crosses the step boundary.** Arguments and resolved values are journaled, so they must be serializable: no closures, callbacks, streams, or live objects. The callee must live at module scope. For a multi-call unit or a callback-taking API, write a module-scope function and wrap the call to it: `await step(sendWithRetry(args))`.

**`jobStep({ inputSchema, outputSchema, run })` is reserved for trust boundaries** — when the values crossing the durability boundary need runtime validation — or for a block that must journal as one unit and can't be expressed as a module-scope function call.

**Branches become helpers.** A conditional path is extracted into a named helper function exactly when it contains steps (`step()`, `jobStep`, `toolbox.*`, `generateText`, `sleep`, `waitForInput`). Pure value-computing conditionals stay inline. Helpers sit below the job in the same file: `step()` is only transformed in files that call `createJob()`, so moving a helper to another file silently breaks it. The payoff is a handler you can read top-down, opening each branch only when you care about it.

**Branch on journaled data.** Conditions that pick a branch must derive from the trigger event or step results, so every replay takes the same path.

**Code outside steps re-runs on every replay.** Keep it pure and cheap; every side effect lives inside a step. A bare `console.log` outside a step prints once per replay; use `await log(...)` from `terse-sdk` (a journaled step) for lines that should print once.

## Worked examples

Method and constant names in both examples come from your project's `src/terse.generated.ts`; never invent them.

### Durable

The job below shows the target durable shape: the handler at the top reading as sequential blocks, an exhaustive switch dispatching to side-effecting branch helpers, schemas and types at the bottom.

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
import { createJob, generateText, type GithubPROpenedTrigger } from "terse-sdk"
import { Triggers, Skills, Repos, SlackChannel, toolbox } from "./terse.generated"

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
