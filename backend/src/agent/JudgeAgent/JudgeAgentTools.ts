import { Agent, AgentOutputType } from "@openai/agents"
import { tool } from "@openai/agents"
import { Tool } from "@openai/agents-core"
import { z } from "zod"

import { settings } from "../../config/settings"
import type { CapabilityDescription } from "../../capabilityHelpers"
import logger from "../../logger"
import { ConfigInstance } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { RunHistoryChatMemorySession, identityHistoryCallback } from "../CustomMemorySession"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { db } from "../../prismaClient"
import { TRIGGER_REGISTRY } from "../../triggers/TriggerRegistry"
import { User } from "../../shared/types"
import { Session } from "../../types/session"
import { AgentWithRelations } from "../../types/prisma"
import { getInputConfigInclude, getOutputConfigInclude } from "../../utility/prismaIncludes"
import { SessionWithTracking } from "../AgentRunner/AgentRunner"
import { SystemPromptBuilder } from "../AgentRunner/SystemPromptBuilder"
import { formatAgentForSystemPrompt } from "../AgentRunner/formatContext"
import { buildChatAgentSystemPrompt } from "../ChatAgent/ChatAgentSystemPrompt"
import { buildChatAgentTools } from "../ChatAgent/ChatAgentTools"

import HeadlessChatInterface from "./HeadlessChatInterface"

const PERIOD_DAYS_DEFAULT = 7

function computeAverageRunDurationMs(runs: Array<{ timestamp: Date; updated_at: Date }>): number {
    if (runs.length === 0) {
        return 0
    }

    const totalDurationMs = runs.reduce((sum, run) => {
        const duration = run.updated_at.getTime() - run.timestamp.getTime()
        return sum + Math.max(0, duration)
    }, 0)
    return Math.round(totalDurationMs / runs.length)
}

export function buildJudgeAgentTools(user: User): Tool[] {
    return [
        tool({
            name: "getAgentConfig",
            description:
                "Get the full configuration of the agent being reviewed: name, system prompt, trigger configs, output/skill configs, tool approvals, notification settings, and behavioral directives.",
            parameters: z.object({
                automationId: z.string()
            }),
            execute: async ({ automationId }) => {
                logger.info("[JudgeAgent:getAgentConfig] Fetching agent config", { automationId })
                const automation = await db().automations.findFirst({
                    where: {
                        id: automationId,
                        organization_id: user.organizationId
                    },
                    include: {
                        prompt: true,
                        inputs: {
                            include: {
                                ...getInputConfigInclude(),
                                attio_config: true
                            }
                        },
                        outputs: {
                            include: getOutputConfigInclude()
                        },
                        tool_approvals: true,
                        notification_settings: true,
                        directiveRecords: {
                            where: { is_active: true },
                            orderBy: { created_at: "asc" },
                            select: {
                                id: true,
                                directive_description: true,
                                created_at: true
                            }
                        }
                    }
                })

                if (!automation) {
                    logger.warn("[JudgeAgent:getAgentConfig] Agent not found", { automationId })
                    throw new Error("Agent not found")
                }

                logger.info("[JudgeAgent:getAgentConfig] Got config", {
                    automationId,
                    agentName: automation.name,
                    triggerCount: automation.inputs.length,
                    outputCount: automation.outputs.length,
                    directiveCount: automation.directiveRecords.length
                })

                const formattedConfig = formatAgentForSystemPrompt(automation)
                const response = {
                    formattedConfig,
                    rawConfig: {
                        id: automation.id,
                        name: automation.name,
                        isActive: automation.is_active,
                        requireApproval: automation.require_approval,
                        improvementsEnabled: automation.improvements_enabled,
                        prompt: automation.prompt?.content ?? "",
                        inputs: automation.inputs,
                        outputs: automation.outputs,
                        toolApprovals: automation.tool_approvals.map(row => row.tool_name),
                        notificationSettings: automation.notification_settings,
                        directives: automation.directiveRecords
                    }
                }

                return JSON.stringify(response)
            }
        }),
        tool({
            name: "getRunHistory",
            description:
                "Get the run history for the agent over a time period. Returns run statuses, timestamps, trigger sources, decision actions and reasons, and whether runs were filtered.",
            parameters: z.object({
                automationId: z.string(),
                periodDays: z.number().int().min(1).max(30).default(PERIOD_DAYS_DEFAULT).describe("Number of days to look back")
            }),
            execute: async ({ automationId, periodDays }) => {
                logger.info("[JudgeAgent:getRunHistory] Fetching run history", { automationId, periodDays })
                const now = new Date()
                const start = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

                const runs = await db().run_history_records.findMany({
                    where: {
                        automation_id: automationId,
                        automation: { organization_id: user.organizationId },
                        timestamp: {
                            gte: start,
                            lte: now
                        }
                    },
                    orderBy: { timestamp: "desc" },
                    select: {
                        id: true,
                        status: true,
                        trigger_source: true,
                        trigger_title: true,
                        decision_action: true,
                        decision_reason: true,
                        filtered: true,
                        is_manually_triggered: true,
                        timestamp: true,
                        created_at: true,
                        updated_at: true
                    }
                })

                const stats = {
                    totalRuns: runs.length,
                    successCount: runs.filter(run => run.status === "success").length,
                    failureCount: runs.filter(run => run.status === "failed").length,
                    filteredCount: runs.filter(run => run.filtered).length,
                    avgDurationMs: computeAverageRunDurationMs(runs),
                    periodStart: start.toISOString(),
                    periodEnd: now.toISOString()
                }

                const normalizedRuns = runs.map(run => ({
                    id: run.id,
                    status: run.status,
                    triggerSource: run.trigger_source,
                    triggerTitle: run.trigger_title,
                    decisionAction: run.decision_action,
                    decisionReason: run.decision_reason,
                    filtered: run.filtered,
                    isManuallyTriggered: run.is_manually_triggered,
                    timestamp: run.timestamp.toISOString(),
                    createdAt: run.created_at.toISOString(),
                    updatedAt: run.updated_at.toISOString()
                }))

                logger.info("[JudgeAgent:getRunHistory] Got run history", {
                    automationId,
                    totalRuns: stats.totalRuns,
                    successCount: stats.successCount,
                    failureCount: stats.failureCount,
                    filteredCount: stats.filteredCount
                })

                return JSON.stringify({ runs: normalizedRuns, stats })
            }
        }),
        tool({
            name: "getRunDetails",
            description:
                "Get detailed logs for a specific run: all actions taken (creates, updates, deletes, reads), their targets, details, URLs, and raw run events. Use this to understand what the agent actually did during a run.",
            parameters: z.object({
                runId: z.string().describe("The run_history_record ID to inspect")
            }),
            execute: async ({ runId }) => {
                logger.info("[JudgeAgent:getRunDetails] Fetching run details", { runId })
                const run = await db().run_history_records.findFirst({
                    where: {
                        id: runId,
                        automation: { organization_id: user.organizationId }
                    },
                    select: {
                        id: true
                    }
                })

                if (!run) {
                    logger.warn("[JudgeAgent:getRunDetails] Run not found", { runId })
                    throw new Error("Run not found")
                }

                const [actions, rawEvents] = await Promise.all([
                    db().run_history_actions.findMany({
                        where: { run_history_record_id: runId },
                        orderBy: { created_at: "asc" },
                        select: {
                            id: true,
                            action: true,
                            integration: true,
                            target: true,
                            details: true,
                            url: true,
                            step_id: true,
                            type: true,
                            is_read_only: true,
                            created_at: true
                        }
                    }),
                    db().run_history_raw_events.findMany({
                        where: { run_history_record_id: runId },
                        orderBy: { sequence_order: "asc" },
                        select: {
                            id: true,
                            raw_event_json: true,
                            sequence_order: true,
                            created_at: true
                        }
                    })
                ])

                const normalizedActions = actions.map(action => ({
                    ...action,
                    createdAt: action.created_at.toISOString()
                }))

                const normalizedRawEvents = rawEvents.map(rawEvent => ({
                    id: rawEvent.id,
                    rawEventJson: rawEvent.raw_event_json,
                    sequenceOrder: rawEvent.sequence_order,
                    createdAt: rawEvent.created_at.toISOString()
                }))

                logger.info("[JudgeAgent:getRunDetails] Got run details", {
                    runId,
                    actionCount: normalizedActions.length,
                    rawEventCount: normalizedRawEvents.length
                })

                return JSON.stringify({ actions: normalizedActions, rawEvents: normalizedRawEvents })
            }
        }),
        tool({
            name: "getChatAgentConfig",
            description:
                "Read the ChatAgent (builder assistant) configuration for the user who owns this agent. Returns the system prompt template and available tool names.",
            parameters: z.object({
                userId: z.string(),
                organizationId: z.string()
            }),
            execute: async ({ userId, organizationId }) => {
                logger.info("[JudgeAgent:getChatAgentConfig] Fetching ChatAgent config", { userId, organizationId })
                const sessionId = `judge-chat-config-${Date.now()}`
                const chatInterface = new HeadlessChatInterface(sessionId, userId, organizationId)
                const systemPrompt = await buildChatAgentSystemPrompt(userId, organizationId)
                const toolNames = buildChatAgentTools(chatInterface).map(toolDef => toolDef.name)

                logger.info("[JudgeAgent:getChatAgentConfig] Got ChatAgent config", { toolCount: toolNames.length })

                return JSON.stringify({
                    systemPrompt,
                    toolNames
                })
            }
        }),
        tool({
            name: "getPastImprovements",
            description:
                "Get all past improvement recommendations made for this agent, including their status (PENDING, APPLIED, DISMISSED). Use this to avoid recommending the same thing twice.",
            parameters: z.object({
                automationId: z.string()
            }),
            execute: async ({ automationId }) => {
                logger.info("[JudgeAgent:getPastImprovements] Fetching past improvements", { automationId })
                const pastImprovements = await db().agent_improvements.findMany({
                    where: {
                        automation_id: automationId,
                        automation: { organization_id: user.organizationId }
                    },
                    orderBy: { created_at: "desc" },
                    select: {
                        title: true,
                        description: true,
                        target_area: true,
                        status: true,
                        created_at: true
                    }
                })

                logger.info("[JudgeAgent:getPastImprovements] Got past improvements", {
                    automationId,
                    totalCount: pastImprovements.length,
                    pendingCount: pastImprovements.filter(i => i.status === "PENDING").length,
                    appliedCount: pastImprovements.filter(i => i.status === "APPLIED").length,
                    dismissedCount: pastImprovements.filter(i => i.status === "DISMISSED").length
                })

                return JSON.stringify(
                    pastImprovements.map(improvement => ({
                        title: improvement.title,
                        description: improvement.description,
                        targetArea: improvement.target_area,
                        status: improvement.status,
                        createdAt: improvement.created_at.toISOString()
                    }))
                )
            }
        }),
        tool({
            name: "interviewAgent",
            description:
                "Ask a question to interview the AgentRunner behavior for a specific run. This reuses the run's raw event history and agent runtime instructions to explain execution reasoning without persisting any new history.",
            parameters: z.object({
                runId: z.string().describe("The run_history_record ID to interview about"),
                question: z.string().describe("A specific question about the agent's behavior, e.g. 'Why did the agent filter out the Slack message about deployment on Jan 15?'")
            }),
            execute: async ({ runId, question }) => {
                logger.info("[JudgeAgent:interviewAgent] Starting interview", { runId, question })
                const runRecord = await db().run_history_records.findFirst({
                    where: {
                        id: runId,
                        automation: { organization_id: user.organizationId }
                    },
                    select: {
                        id: true,
                        automation_id: true
                    }
                })

                if (!runRecord) {
                    logger.warn("[JudgeAgent:interviewAgent] Run not found", { runId })
                    throw new Error("Run not found")
                }

                const automation = await db().automations.findFirst({
                    where: {
                        id: runRecord.automation_id,
                        organization_id: user.organizationId
                    },
                    include: {
                        prompt: true,
                        inputs: {
                            include: {
                                ...getInputConfigInclude(),
                                attio_config: true
                            }
                        },
                        outputs: {
                            include: getOutputConfigInclude()
                        },
                        tool_approvals: true
                    }
                })

                if (!automation) {
                    logger.warn("[JudgeAgent:interviewAgent] Agent not found", { runId, automationId: runRecord.automation_id })
                    throw new Error("Agent not found")
                }

                logger.info("[JudgeAgent:interviewAgent] Building interview context", {
                    runId,
                    automationId: automation.id,
                    agentName: automation.name
                })

                const outputs = OutputFactory.createOutputsFromAgent(automation as AgentWithRelations)
                const session: Session = {
                    user,
                    isUserInitiated: true
                }
                const toolApprovals = automation.tool_approvals.map(row => row.tool_name)
                const context: SessionWithTracking<Session> = {
                    ...session,
                    agent: {
                        requireApproval: automation.require_approval ?? false,
                        toolApprovals
                    },
                    runId: runRecord.id,
                    agentId: automation.id
                }

                const instructions = await new SystemPromptBuilder<SessionWithTracking<Session>, ConfigInstance>(
                    {
                        session: context,
                        agent: automation as AgentWithRelations,
                        outputs
                    },
                    { runId: runRecord.id }
                )
                    .withStandardSections()
                    .build()

                const runConfig = {
                    agentId: automation.id,
                    agentType: AgentType.JUDGE,
                    runId: `judge-interview-${runRecord.id}-${Date.now()}`,
                    user,
                    env: settings.nodeEnv
                }

                const interviewAgent = new Agent<SessionWithTracking<Session>, AgentOutputType>({
                    name: "AgentRunner Interview Agent",
                    instructions:
                        `${instructions}\n\n` +
                        "You are being interviewed about a completed run. Answer using the run's history and execution context. " +
                        "Do not execute external actions, do not propose changes, and if evidence is missing, say so clearly.",
                    model: "gpt-5.2",
                    tools: [],
                    modelSettings: builderProviderDataModelSettings(runConfig)
                })

                const memorySession = new RunHistoryChatMemorySession({
                    sessionId: runRecord.id,
                    skipSave: true,
                    filterIncompleteToolCalls: true
                })

                const runner = runnerFactory(runConfig)

                logger.info("[JudgeAgent:interviewAgent] Running interview agent", { runId, interviewRunId: runConfig.runId })

                const result = await runner.run(
                    interviewAgent,
                    [
                        {
                            role: "user",
                            content: question
                        }
                    ],
                    {
                        context,
                        stream: false,
                        session: memorySession,
                        sessionInputCallback: identityHistoryCallback
                    }
                )

                const output = typeof result.finalOutput === "string" ? result.finalOutput : JSON.stringify(result.finalOutput ?? "")

                logger.info("[JudgeAgent:interviewAgent] Interview complete", {
                    runId,
                    interviewRunId: runConfig.runId,
                    outputLength: output.length
                })

                return output
            }
        }),
        tool({
            name: "lookupPlatformCapabilities",
            description:
                "Look up what triggers and outputs (skills) the Terse platform supports. Returns available integrations, their tools, configuration fields, and descriptions. Use this to verify whether a recommendation is actually achievable on the platform.",
            parameters: z.object({
                category: z.enum(["triggers", "outputs", "all"]).describe("Which capabilities to look up"),
                integration: z.nativeEnum(IntegrationType).nullable().describe("Filter to a specific integration, or null for all")
            }),
            execute: async ({ category, integration }) => {
                logger.info("[JudgeAgent:lookupPlatformCapabilities] Looking up capabilities", { category, integration })
                const filter = integration ?? undefined

                const gatherTriggers = (f?: IntegrationType): CapabilityDescription[] =>
                    TRIGGER_REGISTRY.map(t => t.getCapabilityDescription()).filter(c => !f || c.integrationType === f)

                const gatherOutputs = (f?: IntegrationType): CapabilityDescription[] => {
                    const results: CapabilityDescription[] = []
                    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
                        const output = factory()
                        const cap = output.getCapabilityDescription()
                        if (!f || cap.integrationType === f) results.push(cap)
                    }
                    return results
                }

                if (category === "all") {
                    const triggers = gatherTriggers(filter)
                    const outputs = gatherOutputs(filter)
                    logger.info("[JudgeAgent:lookupPlatformCapabilities] Got capabilities", {
                        category,
                        integration,
                        triggerCount: triggers.length,
                        outputCount: outputs.length
                    })
                    return JSON.stringify({ triggers, outputs })
                }
                if (category === "triggers") {
                    const caps = gatherTriggers(filter)
                    logger.info("[JudgeAgent:lookupPlatformCapabilities] Got trigger capabilities", {
                        integration,
                        count: caps.length
                    })
                    return JSON.stringify(caps)
                }
                const caps = gatherOutputs(filter)
                logger.info("[JudgeAgent:lookupPlatformCapabilities] Got output capabilities", {
                    integration,
                    count: caps.length
                })
                return JSON.stringify(caps)
            }
        })
    ]
}
