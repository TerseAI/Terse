---
name: terse-create
description: Create a Terse workflow. Use when the user wants to build an automation that reacts to events (GitHub PRs, Slack messages, Linear issues, cron schedules, webhooks) and takes actions, or wants to get started with Terse. Bootstraps a new Terse project first when none exists.
license: MIT
metadata:
  author: Terse AI
  version: "0.6.0"
  category: workflow
---

<!-- Generated from templates/terse-create.md.hbs by scripts/build-skills.mjs. Edit the template, not this file. -->

# Create a Terse Workflow

Create a Terse workflow based on: **$ARGUMENTS**

A workflow is the thing being automated; in code it is defined as a job (`createJob` in `src/terse.jobs.ts`).

## Learning how to build the workflow

You should use the following sources to get context on the Terse platform:

1. The code in the project itself if it is present: (src/terse.jobs.ts, src/jobs/)
2. The generated files should be the primary source of truth and explain how Terse works: `src/terse.generated.ts` is the entry point — its header lists every available integration and carries a line-numbered index of the `src/terse.generated/` folder, which holds one file per integration and kind (`<integration>.triggers.ts` for trigger factories and payload types, `<integration>.tools.ts` for typed tool methods, resources and skills, workspace schema files like `attio.schemas.ts`, plus shared plumbing in `common.ts`). Use the index to open only the files the workflow needs. The generated files answer what exists and its exact shape; when they disagree with the live docs, the generated files win — a missing helper means rerun `terse generate`, never code against a docs claim the generated files don't back.
3. The terse cli: (terse --help)
4. The fourth and last option should be to use the live terse docs (docs.useterse.ai). Fetch first the index page (https://docs.useterse.ai/llms.txt) to discover available pages and then only pull the specific pages you need to implement the workflow.

**Do not search or read the dist files for the terse-sdk package.**

## Steps

**Narrate the run.** Speak to the user in casual first person about the work itself: "I'm going to check if the project is set up", "I need some help understanding this use case better", "I'm launching some research agents to figure out how to build this for you", "Based on the research, I have a few more questions". The steps below group into phases — bootstrap (step 0), interview (1), research (2), shared understanding (3), design (4–8), build (9), swap and verify (10–11), deploy (12). Step numbers are internal and never spoken, but the phases are not: at every phase transition, say in plain casual words which phase just finished and which comes next, with its place in the overall sequence — "Research is done — that's 1 of 5 for this build. Next up: agreeing on the design." The user should always know where the build stands from the prose alone.

If your harness has a task-tracking tool the user can see (a todo/task list), keep a checklist too: create it right after step 0 with casually worded items — research how to build this, agree on the design, build the job, swap test targets and verify, ask about deploying — and check items off as phases complete. When the milestone plan lands in step 9, replace the build item with one item per milestone. The checklist supplements the spoken phase transitions; it never replaces them.

**Mark every CLI run.** The `terse` CLI doing something is an event the user must be able to see; harnesses often collapse tool calls, so the narration carries it. Immediately before each `terse` command, emit a marker line:

> ⏵ `terse test run pr-triage --id 3f2c` — proving the trigger wiring fires

One marker per command: the command verbatim in backticks, then the why in a few words. Back-to-back cheap reads (`terse test list`, `terse test show`) may share a single marker. When a state-changing or long-running command finishes (`integrate connect`/`wait`, `generate`, `deploy`, `test run`), report its outcome in the normal narration voice. Never bury a `terse` invocation inside a pipeline, subshell, or script where the user can't see it ran.

**Explain every test before it runs.** A marker line is not enough for `terse test run` or `terse replay`: immediately before one, say in one to three casual sentences what the run exercises, why now, and what a good result looks like — "Now I want to prove the trigger wiring fires before writing any real logic: I'll run the pinned sample PR through the stub handler and expect it to log the event with no errors." When it finishes, give the verdict against that stated expectation in the same voice. Cheap reads (`terse test list`, `terse test show`) keep just the marker.

If `terse test run` prints a `TERSE TEST REPORT`, surface it immediately in your own message. Your first sentence must be either "The test ran as expected" or "The test did not run as expected." Then list the reported side effects exactly and explain any mismatch with your stated expectation.

Narration is non-blocking: never wait for a reply to an announcement; the run only pauses at the questions the steps themselves define.

**Headless runs.** With no one to answer, skip every question the steps define, take your recommended answer, and state each choice with its reason in the final summary. Narrate inline the same way.

### 0. Ensure a Terse project exists

Look for `terse.config.json` or `src/terse.generated.ts` in the working directory. If either exists, the project is set up — skip to step 1.

If the user asked to self-host Terse rather than build a workflow on Terse Cloud, that is a different flow — hand off to the `terse-self-host` skill instead.

If neither file exists, this is a fresh start: bootstrap a new SDK project pointed at Terse Cloud with `terse init`. Terse Cloud hosts the control plane and the data plane.

**Run `terse init`.** Don't preflight. Don't run `find`, `ls`, `terse --version`, or `terse integrate list` to "check the environment" before doing anything. Just run `terse init` and react to whatever it tells you. The CLI already knows how to detect existing projects, missing auth, taken directory names, and a missing `package.json`. Trust its error messages and recover from them.

```bash
terse init <project-name>   # scaffold into a new subdirectory
terse init                  # scaffold into the current directory (must be empty of npm files)
```

If the user named a project directory, pass it; otherwise scaffold into the current directory.

Set the Bash timeout to 600000 (10 minutes). Dependency install and browser-side auth can both take a while.

`terse init` handles auth itself: if the user is not logged in, it opens the browser to WorkOS and waits for them to authorize. Before running it, tell the user casually that a browser tab may pop up and that the setup pauses until they finish signing in there. If the CLI prints a login URL and the user seems stuck, relay that URL as a clickable fallback — the automatic browser open fails silently over SSH or in a container. The single command scaffolds files, installs dependencies, logs in if needed, creates the remote Terse project, writes `terse.config.json`, and runs `terse generate`.

**React to errors.** If `terse init` fails, read the error and recover:

- **`command not found: terse`**: install the CLI with `npm i -g terse-cli` (or `pnpm add -g terse-cli` / `yarn global add terse-cli` if the user prefers), then retry `terse init`.
- **`Detected an existing npm project in this directory`**: the directory has a `package.json`. If it also has a `terse.config.json` or `src/terse.generated.ts`, the user is already set up: stop, do not re-init, and continue with step 1. If it is some other npm project, recommend `terse attach` (adds Terse to an existing project) or rerun with a project name to scaffold a sibling directory.
- **`Directory "X" already exists`**: pick a different project name, or have the user `cd` into the existing directory so you can evaluate from there.
- **`ACTION REQUIRED: Not authenticated`**: only happens in non-interactive / CI mode when no valid stored credentials are present. Run `terse auth login` via Bash with a 10-minute timeout, then retry `terse init`.
- **`Failed to create Terse project`**: the API key is valid but the remote create failed. The local scaffold still exists. Surface the error to the user and suggest retrying after fixing connectivity, or creating the project from the dashboard and writing `terse.config.json` manually.

**Continue.** The CLI prints a "Next steps" block at the end of a successful `terse init`. Don't repeat it verbatim. Connect any integrations the requested workflow needs — run `terse integrate describe <type> --json` first to learn whether the install is form or OAuth and which fields it requires, then `terse integrate connect <type>` per step 7. Then continue with step 1 and build the workflow the user asked for.

`src/terse.generated.ts` and the `src/terse.generated/` folder are the source of truth for connected integrations, available triggers, skills, resources, and deterministic wrappers. The comment at the top of the root file lists every integration currently available in Terse — never plan around an integration that is not in that list — and indexes the per-integration files with the exact file and line for every tool, trigger, and resource. Do not run `terse integrate list` — the generated files already reflect what `terse integrate` connected or what is available to connect in this workspace. For what an available integration can do, `terse integrate tool <type> --json` lists its tools with descriptions, and `terse integrate tool <type> <tool-name> --json` returns one tool's input/output schemas. To see what a tool actually returns, `terse integrate tool run <tool> --params '<json>'` runs it one-shot — see "Testing tool calls from the CLI" in the testing conventions.

If `src/terse.generated.ts` is missing in an existing project, run `terse generate` before inventing helpers. If it exists but does not expose the helper you need, or the header index disagrees with what a leaf file actually contains, rerun `terse generate`. Never edit the generated files directly.

### 1. Initial interview

Interview the user before doing any research: their answers set the direction the workspace scan and the researchers take in step 2.

Ask about decisions and intent only — what should happen, on which events, for whom, and what a good outcome looks like. Do not ask about how to implement it: what is connected, which triggers exist, what the docs support, and what an external API offers are exactly what step 2's scan and researchers retrieve. If the request already pins down the intent unambiguously, skip straight to step 2.

Batch related questions, at most four per interruption. For every question, provide a recommended answer.

While interviewing, sharpen the domain language:

- When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."
- Stress-test domain relationships with concrete scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### 2. Scan the workspace, then dispatch researchers

**Workspace scan — always yours, never a subagent's.** The exact types and signatures must be in your context to write the job in step 9, so delegating this read would only add a wasted pass. Read, in full:

1. `src/terse.generated.ts` (the root file). The header lists every integration currently available in Terse and carries the line-numbered index of the `src/terse.generated/` folder; the re-exports below it reflect what is connected.
2. `src/terse.jobs.ts` (or the project's custom entry file, or the legacy `src/index.ts`) — note existing jobs that overlap or conflict with this workflow.

Then follow the index into the leaf files selectively: for every integration this workflow will touch, read its `terse.generated/<integration>.triggers.ts` and `<integration>.tools.ts` in full before any code is written against them — step 9 needs the exact signatures in your context. Skip only the files for integrations the workflow does not involve. If the index disagrees with what a leaf file actually contains, treat the whole bundle as stale and rerun `terse generate`.

From the scan, carry forward the exact trigger factories (`Triggers.*`), skill factories (`Skills.*`), `toolbox.<integration>.<method>` signatures, and resource constants that match this workflow — only names that literally appear in the generated files, never invented — plus the gaps. Classify each gap against the available-integrations comment: a platform in the list but with no generated files under `terse.generated/` is a connectable built-in (`terse integrate tool <type> --json` lists its tools); a platform absent from the list has no Terse built-in — leave those to the researchers below.

**Researchers** are focused, read-only background research tasks defined by self-contained templates in `references/`. Each produces a research brief in a fixed shape.

- **Integration researcher** ([research-integrations.md](references/research-integrations.md)) — dispatch only after the scan confirms a needed service has no built-in Terse integration (rungs 3–4 of the integration ladder in the conventions section). Researches the platform's official SDK, auth model, and key endpoints.

**Dispatching a researcher.** For each one:

1. Read its template file from `references/`.
2. Replace the "Context from the orchestrator" comment block with real content: the workflow in one paragraph, the platforms/events/actions involved, and the interview answers and scan findings that narrow the search. Where the template has an "Objectives" block, fill it with the specific questions this run needs answered — researchers answer the objectives with the fewest fetches that settle them, so vague objectives buy back the over-reading.
3. If your harness can spawn subagents (an Agent/Task tool), pass the entire filled-in template as the subagent's prompt, using a read-only, web-capable agent type. The template is self-contained: the subagent needs no other context, and its reply is the research brief.
4. If it cannot, follow the filled-in template yourself, inline, and write out the same brief before moving on.

**Background where the harness allows.** Dispatch the integration researcher as soon as the scan justifies it — it can run while you conduct step 3. Inline execution runs the template before moving on.

Researchers are read-only: they must not edit files or run state-changing commands (`terse integrate connect`, `terse generate`, `terse deploy`).

### 3. Reach a shared understanding

Combine your workspace scan with any research briefs, then bring the user everything that changes the design:

- Decisions the research raised: a missing integration to connect or work around, two plausible trigger choices, a capability the research surfaced that suggests a different shape for the workflow.
- Contradictions between what the user asked for and what exists. Surface them; do not silently resolve them.

The same interview rules apply: batch at most four questions, recommend an answer for each, look up facts instead of asking. Walk down each branch of the design tree, resolving dependencies between decisions one by one.

Once the decisions are resolved, draw the workflow as an ASCII diagram: one box per step with its title and the one or two details that matter (marked `agent:` where judgment is involved), the trigger at the top, the side effects at the end. Decisions live on the edges, not in boxes: a filter is a label on the connector, a stop is a `├─►` exit off the spine, and a real branch is two side-by-side boxes that merge back into the spine. Use the domain words from the interview, not code identifiers, and keep it narrow enough for a terminal:

```
┌──────────────────────────────────────────────┐
│ Attio deal record updated                    │
│ object: Deals                                │
└──────────────────────┬───────────────────────┘
                       │ filter: stage = "Negotiation"
                       ▼
┌──────────────────────────────────────────────┐
│ Does #war-<deal-name> already exist?         │
└──────────────────────┬───────────────────────┘
        already exists ├─► stop, the war room is already up
                       ▼ new deal
┌──────────────────────────────────────────────┐
│ Create private channel #war-<deal-name>      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Resolve the invite list                      │
│ fixed group: Olivier + Thomas                │
│ deal owner matched to Slack by email?        │
└──────────┬───────────────────────────┬───────┘
           │ matched                   │ unmatched
           ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│ Add the owner to the    │  │ Invite the fixed group  │
│ invite list             │  │ and post a heads-up     │
└────────────┬────────────┘  └────────────┬────────────┘
             │                            │
             └──────────────┬─────────────┘
                            ▼
┌──────────────────────────────────────────────┐
│ Invite the deal team to the channel          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ agent: write the deal brief                  │
│ pull value, stage, contacts from Attio       │
│ post and pin the brief in the channel        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Schedule the kickoff call                    │
│ location: Google Meet                        │
│ invites emailed to the deal team             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Post the calendar link in the channel        │
└──────────────────────────────────────────────┘
```

The diagram is a separate step from the design questions: resolve every remaining decision through the question batches first, and only then draw it. Send it as its own message with the confirmation ask in plain prose ("Does this match what you have in mind?") and end the turn there, with no tool call in that turn — a question dialog takes over the screen and buries same-turn text, and its preview pane clips tall content on small terminals, so the question tool is never used for this confirmation. The diagram is the shared understanding made visible, and the overall goal every later milestone works toward. Do not start building until the user replies confirming a diagram they have actually seen.

### 4. Open the entry file

Open `src/terse.jobs.ts` (the canonical job entry file). The CLI can still load `src/index.ts` as a legacy fallback, and custom layouts can override the entry file with `--entry-file`.

If the repo already uses a custom entry file, follow that layout and pass `--entry-file` on later `terse` commands.
Job placement follows the project-layout rule in the conventions section: every job lives in its own `src/jobs/<kebab-case-name>.ts` file, and `src/terse.jobs.ts` is a manifest of side-effect imports — create the new job as its own file in `src/jobs/` and add its import line. If the repo still keeps a job inline in `src/terse.jobs.ts`, move it to its own file in `src/jobs/` when you touch it.
If the repo only has `src/index.ts`, treat that as a legacy fallback instead of creating a second competing entry file.
If no runtime entry exists yet, create one:

```typescript
import { createJob, generateText } from "terse-sdk"
```

### 5. Settle durability

Durability changes how the handler is structured, so settle it before writing any handler code. Check the confirmed design against the two signal kinds in the conventions section ("When to be durable").

**A forcing signal is present** (the design waits on human input or time): durability is not a decision, so never ask. State it as a consequence in one line and move on: "This job waits for \<approval/the timer\>, so it runs durable."

**Only the judgment signal is present** (three or more side-effecting milestones, no waits): this is a real trade-off, so ask, presenting your recommendation as the default. Use this copy:

> **Should this job be durable?**
>
> - **Durable** — survives restarts, can pause and wait. e.g. "When a refund over $500 comes in, wait for manager approval in Slack, then process it." The job can sleep for days without losing state.
> - **Non-durable** (default) — a closure in the cloud. e.g. "When a PR opens, post a summary to Slack." Runs once, fast, no constraints; a crash just means that one run failed.
>
> Tradeoff: durable requires every side effect to live in a `step()` and all step data to be serializable.
>
> Recommended for this workflow: \<your recommendation and one-line reason\>

**Neither signal**: the job is non-durable. Don't ask and don't announce it.

For durable jobs, the style rules in the conventions section ("Durable job style") govern the handler; the mechanics (`step()`, `jobStep`, `sleep`, `waitForInput`, replay model) are in https://docs.useterse.ai/core-concepts/durability.

### 6. Pick triggers

Choose triggers based on what events the job should respond to. Your workspace scan surfaced the candidates; import trigger factories and resource constants from `./terse.generated`.

Only use triggers and resources that actually exist in the generated files. Do not invent constants that are not defined there.

### 7. Pick skills and connect integrations

**Skills shape what the model can do during a `generateText` run.** They scope the tools the model is allowed to pick. `toolbox.*` is unscoped and works without any skills at all.

Rules of thumb:
- If a step is fully deterministic, call `toolbox.<integration>.<method>` directly. No skill required.
- If the model needs to choose actions on an integration during a `generateText` run, that integration must be in `skills`.

When the workflow needs a platform, step 2 has already walked the integration ladder in the conventions section ("Integrating with a platform"): the workspace scan settles what is connected and whether a built-in type exists, and the integration brief covers the external rungs. Confirm the rung and stop at the first one that works; for the community-wrapper rung, put the choice to the user with the brief's evidence.

Connecting a missing built-in integration type:

- **Always describe before connecting.** Run `terse integrate describe <type> --json` first: it returns the `installationType` (form or OAuth), and for form installs the exact fields the connect command requires — each field's name, type, whether it is required, and a hint — plus any setup URL for console work the user must do first. Never guess field names.
- For form installs, collect a value for every required field from the describe output — ask the user for the ones you cannot derive, relaying the field hints and any setup URL — then run `terse integrate connect <type> --field key=value --fields-stdin`
- Put secrets on `--fields-stdin`, not `--field`
- For OAuth installs, you are the user's only messenger: in `--json` mode the CLI's own "ACTION REQUIRED" line is suppressed, and the browser open is best-effort (it fails silently over SSH or in a container). So, in order:
  1. Tell the user first, casually, what is about to happen and that the run pauses until they act: "I'm connecting Gmail now — a browser tab will pop up; finish the sign-in there and I'll pick it back up."
  2. Run `terse integrate connect <type> --json`. It opens the browser and exits 2 with a `handoff` payload containing the authorization `url` and a `waitCommand`.
  3. Give the user the `url` from the payload as a clickable fallback: "If no tab appeared, here's the link: <url>".
  4. Run the `waitCommand` (e.g. `terse integrate wait gmail`) to block until they finish authorization — it exits 0 when the connection is live. Only then continue.
- If you need multiple OAuth integrations, do them one at a time: announce → `connect <a> --json` → `wait <a>` → announce → `connect <b> --json` → `wait <b>`. Do not batch the connect calls; the user can only authorize one browser tab at a time anyway.
- After any connection or refresh, rerun `terse generate` and reread the header index plus the leaf files for the integrations this workflow touches

For anything past the built-in rungs, credentials follow the Credentials rule in the conventions section ("Integrating with a platform").

When those credentials take manual console work (creating a service account, generating a key, sharing a resource), deliver the integration brief's setup walkthrough at the moment the user actually needs to act — not earlier, not compressed. Relay its numbered steps with their links and role/scope grants intact; do not paraphrase them into vaguer steps. Append the exact `terse secrets add` command for each secret, following the Credentials rule (the base64 one-liner for file credentials). Steps the brief marked `(unverified)` keep that marker when relayed, so the user knows which links or role names to double-check instead of trusting them blindly.

### 8. Consider a filter

Add a `filter` function if the job should skip certain events:
- Bot-generated events (`event.sender.login.includes("[bot]")`)
- Draft PRs, WIP items, or specific labels
- Events from specific users or repos

Filters prevent unnecessary agent runs and save cost.

### 9. Build the handler in milestones

The "Terse Job Code Conventions" section at the bottom of this file governs every line of handler code below. Exact names and signatures come from your step 2 read of the generated files, never from memory of the design discussion; reopen them only if `terse generate` has rerun since the scan (step 7 reruns it after connecting an integration).

Never build the whole handler and test at the end. Slice the workflow into milestones — logical groupings like gather context, decide, act — and prove each one green before starting the next. The worked examples in the conventions section (durable and non-durable) show the target shape; the durable one is sliced into milestones — anchor your slicing on it.

Present the milestone plan before writing Milestone 0: one line per milestone naming what it does and whether it is deterministic or agentic — as checklist items when a task tool is active, plain text otherwise. Each milestone should map to a recognizable region of the step 3 diagram, so the user can see the goal being approached slice by slice. Milestone numbers are internal; name the slices by what they do. Do not wait for approval — step 3 already confirmed the design — but this roadmap is what every green report below tracks against.

**Milestone 0 — tracer bullet.** Wire the trigger, the filter, and a stub handler that just logs the event. Then pin a sample event and prove the wiring fires:

```bash
terse test list "<job-name>" --json
terse test show <id> "<job-name>" --json
terse test run "<job-name>" --id <id>
```

Use `terse test show` to pick a representative event, then reuse that same `--id` for every later run so runs stay comparable. Use `terse test run --event-file <path>` or `--event <json>` when you already have the exact serialized trigger payload. If multiple jobs exist, pass the job name explicitly — non-interactive job loading cannot prompt. Reserve bare `terse test` for manual sessions with a TTY.

To test a specific payload, or when the sample buffer is empty (a fresh webhook has no stored deliveries), hand-write the event file and run it: on a shape mismatch, `terse test run` prints the expected envelope and the exact validation issues — correct the file from that error output rather than guessing fields.

**Test targets.** Before the first milestone that writes to an external surface, ask the user once: "Which channel/repo should I use for test runs? (I'll swap to the real targets at the end.)" In the same ask, when an involved API bills or has customer-visible effects, ask whether it has a test-mode key to use while building (`terse secrets add <NAME>`). Point side-effecting calls at those test resources while building. If the user says to use the real ones, proceed live. The "Testing Safety Conventions" section at the bottom of this file governs every test run — real data, test keys, production writes, probing.

**Each following milestone.** Plan the pipeline deterministic-first, agent-last:

- **Deterministic milestones** — map each known action to `toolbox` (no agent):

  ```typescript
  import { toolbox, SlackChannel } from "./terse.generated"

  await toolbox.slack.sendMessage({
      channelId: SlackChannel.Engineering.channelId,
      message: `New PR: ${event.pullRequest.title}`,
      thread_ts: "",
      blocks: "",
  })
  ```

- **Agentic milestones** — use `generateText` wherever judgment is required (summarize, triage, draft). Include full event context via `event.formatForAgentRunner()`; write specific prompts, and pass an `outputSchema` (a Zod schema) to get a typed, validated object back. Reach for `TerseAgent.create()` only for streaming with `run()` or reusing one agent instance across calls.

- If the user's request is fully deterministic (e.g. "post X to Slack when Y happens"), do not create an agent at all.

After adding each milestone, take it to **green** — all three, in order:

1. `pnpm exec tsc --noEmit` passes (use `npx tsc --noEmit` if that matches the project).
2. `terse test run "<job-name>" --id <pinned-id>` completes without error.
3. For agentic milestones, read the actual output (the message text, the summary) and judge it against the prompt's intent. Exit code 0 is not green on its own.

When a milestone goes green, tell the user before starting the next one — casually, by what it does, never as "milestone N complete", carrying the three green checks as evidence:

> Triage agent just finished: typecheck and the test run both pass, and the summary it wrote reads well.

If the milestone deviated from the presented plan, say what changed and why in the same breath. Do not wait for a reply; if a checklist is active, also check the item off.

Re-runs re-execute every earlier milestone, including its `generateText` calls; that cost is what makes green trustworthy. The test targets absorb the repeated side effects.

### 10. Swap to real targets

The swap is the final milestone. 
Enumerate every test resource and test-mode secret you pointed at in step 9 and switch each back to the real one — list them explicitly so none is missed. 

Ask the user if they want to run a full green check one last time with real production data or just deploy the workflow. 

This run fires the real side effects once; tell the user before running it.

### 11. Final check

Verify the things that are easy to get wrong:
- Every `Triggers.<integration>.…`, `Skills.<integration>(…)`, resource constant, and tool call exists in the generated files. Inventing constants that aren't there is the most common failure.
- Known calls use `toolbox`; only steps that need judgment use `generateText`. `TerseAgent.create()` appears only when streaming or reusing an agent.
- `skills` lists every integration the model must call during a `generateText` run.
- Agent prompts include full event context via `event.formatForAgentRunner()`.
- Imports resolve to real exports from `terse-sdk` and `./terse.generated`.
- The code follows the conventions section: no stray casts, exhaustive switches, custom error classes, stepdown ordering, types at the bottom.
- Durable jobs: every side effect lives in a step, branch helpers sit below the job in the same file, only serializable data crosses step boundaries.
- Every test target from step 9 is swapped back to the real resource.

### 12. Ask before deploying

Do not run `terse deploy` automatically. After the job is written and verified, ask the user whether to deploy it now.

Example prompt:

> The workflow is ready locally. Deploy it to production with `terse deploy`? (This syncs all jobs in the project — removed jobs are deleted remotely.)

- If the user says yes, run `terse deploy` and report the outcome.
- If the user says no or wants more changes, stop without deploying and remind them they can run `terse deploy` when ready.

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
- The connection is auto-resolved from the project's pinned connection (`terse integrate use <type> <connection-id>`) or the workspace's single connection; with several and no pin, list IDs with `terse integrate connections <type> --json`, then retry with `--integration <id>` or pin one.
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
- **Judgment signal** — three or more side-effecting milestones where a mid-run failure would leave visible half-done work. This is a genuine trade-off: recommend `durable: true` and let the user decide.

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

It was built milestone by milestone, each proven green (`tsc --noEmit` passes, `terse test run` on the pinned sample event completes, agentic output inspected) before the next began:

- **Milestone 0** — trigger + filter + a stub handler logging the event
- **Milestone 1** — classify the issue (`generateText` with `outputSchema`)
- **Milestone 2** — the routine branch (`fileRoutine`)
- **Milestone 3** — the critical branch with approval and wait (`escalateCritical`)

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
