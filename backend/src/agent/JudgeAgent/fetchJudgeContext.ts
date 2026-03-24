import logger from "../../logger"
import { db } from "../../prismaClient"
import { getInputConfigInclude, getOutputConfigInclude } from "../../utility/prismaIncludes"
import { formatAgentForSystemPrompt } from "../AgentRunner/formatContext"

const PERIOD_DAYS_DEFAULT = 7

function computeAverageRunDurationMs(runs: Array<{ timestamp: Date; updated_at: Date }>): number {
    if (runs.length === 0) return 0
    const totalDurationMs = runs.reduce((sum, run) => {
        return sum + Math.max(0, run.updated_at.getTime() - run.timestamp.getTime())
    }, 0)
    return Math.round(totalDurationMs / runs.length)
}

export async function fetchAgentConfig(automationId: string, orgId: string) {
    logger.info("[fetchJudgeContext:agentConfig] Fetching", { automationId })
    const automation = await db().automations.findFirst({
        where: { id: automationId, organization_id: orgId },
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
            notification_settings: true
        }
    })

    if (!automation) throw new Error("Agent not found")

    const formattedConfig = formatAgentForSystemPrompt(automation)

    return {
        formattedConfig,
        rawConfig: {
            id: automation.id,
            name: automation.name,
            source: automation.source,
            isActive: automation.is_active,
            requireApproval: automation.require_approval,
            improvementsEnabled: automation.improvements_enabled,
            prompt: automation.source === "SDK" ? "[SDK]" : (automation.prompt?.content ?? ""),
            inputs: automation.inputs,
            outputs: automation.outputs,
            toolApprovals: automation.tool_approvals.map(row => row.tool_name),
            notificationSettings: automation.notification_settings
        },
        gcsKey: automation.prompt?.source_code_gcs_key ?? undefined
    }
}

export async function fetchRunHistory(automationId: string, orgId: string, periodDays = PERIOD_DAYS_DEFAULT) {
    logger.info("[fetchJudgeContext:runHistory] Fetching", { automationId, periodDays })
    const now = new Date()
    const start = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

    const runs = await db().run_history_records.findMany({
        where: {
            automation_id: automationId,
            automation: { organization_id: orgId },
            timestamp: { gte: start, lte: now }
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

    return { runs: normalizedRuns, stats }
}

export async function fetchRunDetails(runId: string, orgId: string) {
    logger.info("[fetchJudgeContext:runDetails] Fetching", { runId })
    const run = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: orgId } },
        select: { id: true }
    })

    if (!run) throw new Error("Run not found")

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

    return {
        actions: actions.map(a => ({ ...a, createdAt: a.created_at.toISOString() })),
        rawEvents: rawEvents.map(e => ({
            id: e.id,
            rawEventJson: e.raw_event_json,
            sequenceOrder: e.sequence_order,
            createdAt: e.created_at.toISOString()
        }))
    }
}

export async function fetchPastImprovements(automationId: string, orgId: string) {
    logger.info("[fetchJudgeContext:pastImprovements] Fetching", { automationId })
    const pastImprovements = await db().agent_improvements.findMany({
        where: {
            automation_id: automationId,
            automation: { organization_id: orgId }
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

    return pastImprovements.map(improvement => ({
        title: improvement.title,
        description: improvement.description,
        targetArea: improvement.target_area,
        status: improvement.status,
        createdAt: improvement.created_at.toISOString()
    }))
}

export interface JudgeContext {
    agentConfig: Awaited<ReturnType<typeof fetchAgentConfig>>
    runHistory: Awaited<ReturnType<typeof fetchRunHistory>>
    runDetails: Array<{ runId: string; details: Awaited<ReturnType<typeof fetchRunDetails>> }>
    pastImprovements: Awaited<ReturnType<typeof fetchPastImprovements>>
}

export async function fetchFullJudgeContext(automationId: string, orgId: string): Promise<JudgeContext> {
    const [agentConfig, runHistory, pastImprovements] = await Promise.all([
        fetchAgentConfig(automationId, orgId),
        fetchRunHistory(automationId, orgId),
        fetchPastImprovements(automationId, orgId)
    ])

    // Fetch details for failed runs (most interesting for improvements)
    const failedRuns = runHistory.runs.filter(r => r.status === "failed").slice(0, 5)
    const runDetails = await Promise.all(
        failedRuns.map(async run => ({
            runId: run.id,
            details: await fetchRunDetails(run.id, orgId)
        }))
    )

    return { agentConfig, runHistory, runDetails, pastImprovements }
}
