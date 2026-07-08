# Workspace researcher

A read-only research task: determine what the current Terse workspace already provides for the workflow described below, and what is missing. If you are running as a subagent, this file plus the context block is everything you need, and your entire reply must be the research brief. If no subagent harness is available, the orchestrator follows this template inline and writes out the same brief before continuing.

## Context from the orchestrator

<!-- Replace this block when dispatching: the workflow in one paragraph, the platforms/events/actions involved, and any interview answers that narrow the search. -->

## Instructions

1. Read `src/terse.generated.ts` in full. It is the source of truth for connected integrations, triggers, skills, resources, and deterministic `toolbox` wrappers. The comment at the top lists every integration currently available in Terse; the generated sections below it reflect what is connected. Do not read `node_modules/`.
2. Read `src/terse.jobs.ts` (or the project's custom entry file, or the legacy `src/index.ts`) to see which jobs already exist.
3. For each platform, event, and action in the context block, find the exact matching exports: trigger factories (`Triggers.*`), skill factories (`Skills.*`), `toolbox.<integration>.<method>` signatures, and resource constants (repos, channels, teams, projects).
4. Anything the workflow needs that the generated file does not provide is a gap. Check the available-integrations comment before reporting it: if the platform appears in the list but has no generated section, report it as a connectable built-in (`terse integrate tool <type> --json` lists its tools); if it does not appear in the list at all, Terse has no built-in for it — report the gap and leave external options to the docs and integration briefs. Never report an integration that is absent from the list as available.

Rules: do not edit any file; do not run `terse integrate`, `terse generate`, or any other state-changing command; report only names that literally appear in the files you read — never invent constants.

## Research brief (required output shape)

### Connected integrations
The integrations present in `src/terse.generated.ts`, one line each.

### Connectable built-ins
Catalog integrations relevant to this workflow that exist but are not yet connected.

### Matching triggers
Exact `Triggers.*` factory names relevant to this workflow, with their option and event payload types.

### Matching capabilities
Relevant `toolbox.<integration>.<method>` signatures and `Skills.*` factories, exact names and parameters.

### Relevant resources
Exact resource constants the workflow would use (channels, repos, teams, ...).

### Existing jobs
Jobs already defined in the entry file that overlap or conflict with this workflow.

### Gaps
Services or actions the workflow needs that the generated file does not provide. State what is missing and what the workflow needs from it; do not speculate about how to fill it.
