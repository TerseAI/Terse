import { MAX_IMPROVEMENTS_PER_AGENT } from "./JudgeAgent"
import { JudgeContext } from "./fetchJudgeContext"

export function buildClaudeCodePrompt(automationId: string, context: JudgeContext): string {
    const { agentConfig, runHistory, runDetails, pastImprovements } = context

    const contextSection = `
== Agent Configuration ==
${agentConfig.formattedConfig}

== Run History (last 7 days) ==
Stats: ${runHistory.stats.totalRuns} total runs, ${runHistory.stats.successCount} succeeded, ${runHistory.stats.failureCount} failed, ${runHistory.stats.filteredCount} filtered
Average duration: ${runHistory.stats.avgDurationMs}ms

Runs:
${runHistory.runs
    .slice(0, 20)
    .map(
        r =>
            `- [${r.status}] ${r.timestamp} | trigger: ${r.triggerSource} | ${r.triggerTitle ?? ""} ${r.filtered ? "(filtered)" : ""} ${r.decisionAction ? `| decision: ${r.decisionAction} - ${r.decisionReason}` : ""}`
    )
    .join("\n")}

${
    runDetails.length > 0
        ? `== Failed Run Details ==\n${runDetails
              .map(rd => `--- Run ${rd.runId} ---\nActions: ${JSON.stringify(rd.details.actions.slice(0, 10), null, 2)}\nEvents: ${JSON.stringify(rd.details.rawEvents.slice(0, 5), null, 2)}`)
              .join("\n\n")}`
        : ""
}

== Past Improvements (do NOT repeat these) ==
${pastImprovements.length > 0 ? pastImprovements.map(i => `- [${i.status}] "${i.title}" (${i.targetArea}): ${i.description}`).join("\n") : "No past improvements."}
`.trim()

    return `You are reviewing SDK automation "${automationId}" for the Terse platform.

== Your task ==

Analyze this agent's source code, configuration, and recent run history to identify concrete improvements. The agent's source code is at /tmp/project — explore it yourself.

== How Terse agents work ==

Read /tmp/project/CLAUDE.md for full documentation on how Terse, the CLI, and the SDK work — including the job API, triggers, skills, event types, and best practices.

In short: Terse is an automation platform. Users build agents that react to events and take actions on external tools.

Triggers: Define what events an agent listens to — Slack messages, GitHub PRs, Jira ticket updates, Linear issues, Gmail emails, Figma comments, cron schedules, etc. An agent can have multiple triggers. Each trigger is configured to watch a specific source.

Event filtering: Before the agent runs, an EventFilter checks if the incoming event is relevant. Events that don't pass the filter show as "filtered" in run history — this is normal.

Outputs / Skills: Give the agent tools to act on external systems. The agent can ONLY interact with systems it has output configs for.

This is an SDK job — a code-based automation written and deployed by a developer via the Terse CLI/SDK.

== Things to ignore — do NOT flag these ==

- Manual/test runs. Users test their agents frequently — that's normal.
- Approval settings. You can see the current config but not the historical config.
- Configuration that the user controls directly (trigger sources, approval toggles, notification settings).
- Tool targeting and routing details.

== Context ==

${contextSection}

== Instructions ==

1. Explore the source code in /tmp/project yourself. Read the files, understand the structure.
2. Based on the run history and code, identify up to ${MAX_IMPROVEMENTS_PER_AGENT} improvements.
3. Only flag things you're confident about (confidence >= 0.7).
4. Don't repeat past improvements listed above.
5. For each code improvement, you MUST implement the change by editing the actual files.

== Workflow for each improvement ==

For EACH code improvement, follow these steps in order:

1. Edit the source files to implement the improvement.
2. Run: git diff
3. Save the diff output — this is the patch for this improvement.
4. Run: git checkout .
   (This resets the files so the next improvement starts clean.)

After processing all improvements, return your structured response. The output schema is enforced automatically — just populate the fields:
- title: Short headline for the review (under 8 words)
- summary: 1-2 casual sentences, like a helpful teammate
- improvements: array of improvements, each with title, description, targetArea, confidence, and suggestedPatch

For non-code improvements (trigger_config, output_config, general), skip the edit/diff workflow and omit suggestedPatch.

If everything looks good, return an empty improvements array.

IMPORTANT: The suggestedPatch MUST be the exact output of git diff, not hand-written. This ensures the patch is always valid and applicable.
`
}
