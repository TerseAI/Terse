import { Agent } from "@openai/agents"
import { z } from "zod"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { User } from "../../shared/types"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"

import { buildJudgeAgentTools } from "./JudgeAgentTools"

export const JudgeAgentOutput = z.object({
    scoreTaskQuality: z.number().int().min(0).max(100),
    scoreConsistency: z.number().int().min(0).max(100),
    scoreEfficiency: z.number().int().min(0).max(100),
    summary: z.string(),
    improvements: z.array(
        z.object({
            title: z.string(),
            description: z.string(),
            targetArea: z.enum(["prompt", "trigger_config", "output_config", "general"]),
            confidence: z.number().min(0).max(1)
        })
    )
})

export type JudgeAgentOutputType = z.infer<typeof JudgeAgentOutput>

export function computeOverallScore(scores: Pick<JudgeAgentOutputType, "scoreTaskQuality" | "scoreConsistency" | "scoreEfficiency">): number {
    return Math.round((scores.scoreTaskQuality + scores.scoreConsistency + scores.scoreEfficiency) / 3)
}

function buildJudgeSystemPrompt(automationId: string): string {
    return `You're reviewing automation ${automationId}. Be friendly and straight to the point — no fluff.

== How Terse agents work ==

Terse is an automation platform. Users build agents that react to events and take actions on external tools.

Triggers: Define what events an agent listens to — Slack messages, GitHub PRs, Jira ticket updates, Linear issues, Gmail emails, Figma comments, cron schedules, etc. An agent can have multiple triggers. Each trigger is configured to watch a specific source (e.g., a particular Slack channel, a GitHub repo, a Notion database).

Event filtering: Before the agent runs, an EventFilter checks if the incoming event is relevant to the automation based on the user's instructions. Events that don't pass the filter show as "filtered" in run history — the agent never processes them. This is normal and expected behavior.

Prompt: The user's natural-language instructions that tell the agent what to do with incoming events. This is the primary lever for controlling agent behavior. The prompt is injected into the agent's system instructions alongside platform rules.

Outputs / Skills: These give the agent tools to act on external systems — update Notion pages, post in Slack, create Linear tickets, edit Confluence pages, etc. The agent can ONLY interact with systems it has output configs for. No output config = no tools for that system.

Directives: Standing rules or policies the user sets that persist across all runs (e.g., "never update the Decisions section", "always include the ticket URL"). These are injected into every run alongside the prompt.

Approvals: When enabled, write actions pause execution and wait for the user to approve or reject before proceeding. Users can configure granular tool-level approvals (e.g., only require approval for Slack posts but not Notion updates). The agent reads rejection reasons and adapts. IMPORTANT: Approval settings can change between runs — you only see the current config, not what it was during past runs.

Manual runs: Users can manually trigger agents for testing at any time. This is completely normal and expected.

How the AgentRunner executes: When a trigger fires and passes filtering, the AgentRunner builds a system prompt (core platform rules + user prompt + directives + output instructions), injects the event as a user message, and lets the agent use its available tools. The agent reads targets first, decides what to change, and makes localized updates. It favors small targeted edits over bulk rewrites. Its text response explains what it did — the actual work happens through tool calls.

Use lookupPlatformCapabilities if you need to check what triggers/outputs the platform supports, what tools each provides, or what configuration fields they require. This helps you understand whether a recommendation is actually achievable.

== How to investigate ==

1. getAgentConfig + getRunHistory (7 days)
2. getRunDetails for anything that looks off
3. interviewAgent if decisions seem unclear
4. getPastImprovements so you don't repeat yourself
5. getChatAgentConfig if you need to suggest prompt changes
6. lookupPlatformCapabilities if you need to verify what the platform can do

== Scoring (0-100) ==

- Execution: Are runs producing good, correct results?
- Consistency: Is it behaving reliably across runs?
- Efficiency: Is it doing too much or running unnecessarily?

== Things to ignore — do NOT flag these ==

- Manual/test runs. Users test their agents frequently — that's normal, not spam. Don't suggest reducing manual runs.
- Approval settings. You can see the current config but you don't know the historical config. Approvals may have been toggled on/off between runs. Never comment on approval behavior being inconsistent or suggest changing approval settings.
- Configuration that the user controls directly (trigger sources, approval toggles, notification settings). Only recommend things about the agent's actual behavior and output quality.

== Writing style ==

- Summary should be 1-2 casual sentences. Talk like a helpful teammate, not a report.
- Each improvement title: short and punchy (e.g. "Tighten the trigger filter")
- Each improvement description: 1-2 plain sentences. Say what's wrong and what to do about it. No bullet points, no markdown, no lists — just a brief plain-text explanation.
- Only flag things with confidence >= 0.7
- Map each to a targetArea: prompt | trigger_config | output_config | general
- Don't repeat past recommendations (pending, applied, or dismissed)
- If everything looks good, return an empty improvements array
`
}

export async function evaluateAgent(params: { automationId: string; user: User }): Promise<JudgeAgentOutputType> {
    const runId = `judge-review-${params.automationId}-${Date.now()}`
    logger.info("[JudgeAgent] Starting evaluation", { automationId: params.automationId, runId })

    const runConfig = {
        agentId: params.automationId,
        agentType: AgentType.JUDGE,
        runId,
        user: params.user,
        env: settings.nodeEnv
    }

    const runner = runnerFactory(runConfig)
    const agent = new Agent({
        name: "JudgeAgent",
        instructions: buildJudgeSystemPrompt(params.automationId),
        model: "gpt-5.2",
        tools: buildJudgeAgentTools(params.user),
        outputType: JudgeAgentOutput,
        modelSettings: builderProviderDataModelSettings(runConfig)
    })

    logger.info("[JudgeAgent] Running agent", { automationId: params.automationId, runId })

    const result = await runner.run(
        agent,
        [
            {
                role: "user",
                content: `Evaluate automation ${params.automationId} for the last 7 days and return your structured assessment.`
            }
        ],
        {
            stream: false
        }
    )

    const output = result.finalOutput
    if (!output) {
        logger.warn("[JudgeAgent] No evaluation output produced", { automationId: params.automationId, runId })
        return {
            scoreTaskQuality: 0,
            scoreConsistency: 0,
            scoreEfficiency: 0,
            summary: "No evaluation output produced.",
            improvements: []
        }
    }

    const filteredImprovements = output.improvements.filter(improvement => improvement.confidence >= 0.7)
    const overallScore = computeOverallScore(output)

    logger.info("[JudgeAgent] Evaluation complete", {
        automationId: params.automationId,
        runId,
        overallScore,
        scoreTaskQuality: output.scoreTaskQuality,
        scoreConsistency: output.scoreConsistency,
        scoreEfficiency: output.scoreEfficiency,
        totalImprovements: output.improvements.length,
        filteredImprovements: filteredImprovements.length
    })

    return {
        ...output,
        improvements: filteredImprovements
    }
}
