# Docs researcher

A read-only research task over the live Terse docs: report the features relevant to the workflow described below. If you are running as a subagent, this file plus the context block is everything you need, and your entire reply must be the research brief. If no subagent harness is available, the orchestrator follows this template inline and writes out the same brief before continuing.

## Context from the orchestrator

<!-- Replace this block when dispatching: the workflow in one paragraph, every platform involved, and the capabilities in question (e.g. human approval, timed waits, scheduling, observability). -->

## Instructions

1. Fetch https://docs.useterse.ai/llms.txt first — it indexes every docs page.
2. Fetch every page plausibly relevant to the context block (triggers, skills, durability, integrations, CLI, observability, ...). Prefer fetching one page too many over guessing from the index alone.
3. Judge relevance against this specific workflow, not Terse in general. A feature belongs in the brief only if it would change how this job is designed, built, or tested.
4. Web fetches only: do not edit files or run commands.

## Research brief (required output shape)

### Relevant features
For each: the feature, why it matters for this workflow, and the doc URL.

### Integration coverage
For each platform in the context block: does Terse ship a built-in integration type for it? Cite the docs page. This decides whether the gap is "connect it" or "external SDK".

### Constraints and gotchas
Limits, prerequisites, or behaviors in the docs that would surprise someone designing this workflow.

### Relevant CLI commands
Exact commands and flags from https://docs.useterse.ai/reference/cli the orchestrator will need for this workflow.
