import { Prisma } from "@prisma/client"
import { serializedEventSchema } from "terse-types"
import { type TriggerPayload } from "terse-types"
import { type GetRunHistoryParams, type RunHistoryModelEvent, type RunHistoryRecord, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { getRunHistoryModelEventsWithActions } from "../../agent/runHistoryModelEvents"
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory, convertPrismaRunHistoryStatusToShared } from "../../utility/typeConverters"

import { RunHistoryWhere, countAndListRunHistory, findActionsByIdsInOrg, findAgentInOrg, findRunRecordForChat } from "./repository"

const MAX_TRIGGER_PAYLOAD_RESPONSE_CHARS = 256 * 1024

const VALID_STATUSES: RunHistoryStatus[] = [
    RunHistoryStatus.SUCCESS,
    RunHistoryStatus.FAILED,
    RunHistoryStatus.CANCELLED,
    RunHistoryStatus.SKIPPED,
    RunHistoryStatus.IN_PROGRESS,
    RunHistoryStatus.AWAITING_APPROVAL
]

export class AgentNotFoundError extends Error {
    constructor() {
        super("Agent not found")
        this.name = "AgentNotFoundError"
    }
}

export class RunNotFoundError extends Error {
    constructor() {
        super("Run not found")
        this.name = "RunNotFoundError"
    }
}

function parseDate(value?: string): Date | undefined {
    if (!value) return undefined
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
}

function parseStatusArray(statusParam?: string): RunHistoryStatus[] | undefined {
    if (!statusParam?.trim()) return undefined
    const statusList = statusParam
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .filter((s): s is RunHistoryStatus => VALID_STATUSES.includes(s as RunHistoryStatus))
    return statusList.length > 0 ? statusList : undefined
}

export function parseGetRunHistoryParams(query: Record<string, unknown>): GetRunHistoryParams {
    const params: GetRunHistoryParams = {}
    if (query.q) {
        const q = String(query.q).trim()
        if (q) params.q = q
    }
    if (query.start) {
        const start = String(query.start).trim()
        if (start) params.start = start
    }
    if (query.end) {
        const end = String(query.end).trim()
        if (end) params.end = end
    }
    if (query.status) {
        const status = parseStatusArray(String(query.status))
        if (status) params.status = status
    }
    if (query.page) {
        const page = parseInt(String(query.page), 10)
        if (!isNaN(page) && page > 0) params.page = page
    }
    if (query.pageSize) {
        const pageSize = parseInt(String(query.pageSize), 10)
        if (!isNaN(pageSize) && pageSize > 0) params.pageSize = pageSize
    }
    return params
}

function applyFilters(where: RunHistoryWhere, params: GetRunHistoryParams, includeAgentSearch: boolean): RunHistoryWhere {
    if (params.start || params.end) {
        const startDate = parseDate(params.start)
        const endDate = parseDate(params.end)
        if (startDate || endDate) {
            where.timestamp = {}
            if (startDate) where.timestamp.gte = startDate
            if (endDate) where.timestamp.lte = endDate
        }
    }
    if (params.status && params.status.length > 0) {
        where.status = { in: params.status }
    }
    if (params.q) {
        const orFilters: Prisma.run_history_recordsWhereInput[] = [
            { id: { contains: params.q, mode: "insensitive" } },
            { trigger_title: { contains: params.q, mode: "insensitive" } },
            { event: { contains: params.q, mode: "insensitive" } },
            { trigger_source: { contains: params.q, mode: "insensitive" } },
            { decision_reason: { contains: params.q, mode: "insensitive" } }
        ]
        if (includeAgentSearch) {
            orFilters.push({ automation: { name: { contains: params.q, mode: "insensitive" } } })
        }
        where.OR = orFilters
    }
    return where
}

function mapActions(actions: import("@prisma/client").run_history_actions[]) {
    return actions.map(action => ({
        action: action.action,
        integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
        step_id: action.step_id ?? undefined,
        type: action.type
    }))
}

export async function listAllRunHistory(organizationId: string, params: GetRunHistoryParams, skip: number, take: number) {
    const where = applyFilters({ automation: { organization_id: organizationId } } as RunHistoryWhere, params, true)
    const [total, rows] = await countAndListRunHistory(where, { skip, take, includeAgent: true })
    const items = rows.map(runRecord => ({
        id: runRecord.id,
        agentId: runRecord.automation_id,
        agentName: (runRecord as { automation?: { name?: string } }).automation?.name,
        timestamp: runRecord.timestamp.toISOString(),
        trigger: {
            event: runRecord.event,
            integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(runRecord.trigger_integration),
            source: runRecord.trigger_source,
            title: runRecord.trigger_title ?? undefined,
            subheader: runRecord.trigger_subheader ?? undefined,
            url: runRecord.trigger_url ?? undefined
        },
        filtered: runRecord.filtered,
        decision: {
            action: runRecord.decision_action,
            reasoning: runRecord.decision_reason
        },
        actions: mapActions(runRecord.actions),
        status: convertPrismaRunHistoryStatusToShared(runRecord.status),
        isManuallyTriggered: runRecord.is_manually_triggered
    }))
    return { items, total }
}

export async function listRunHistoryForAgent(agentId: string, organizationId: string, params: GetRunHistoryParams, skip: number, take: number) {
    const agent = await findAgentInOrg(agentId, organizationId)
    if (!agent) throw new AgentNotFoundError()
    const where = applyFilters({ automation_id: agentId } as RunHistoryWhere, params, false)
    const [total, rows] = await countAndListRunHistory(where, { skip, take, includeAgent: false })
    const items: RunHistoryRecord[] = rows.map(runRecord => ({
        id: runRecord.id,
        agentId: runRecord.automation_id,
        timestamp: runRecord.timestamp.toISOString(),
        trigger: {
            event: runRecord.event,
            integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(runRecord.trigger_integration),
            source: runRecord.trigger_source,
            title: runRecord.trigger_title ?? undefined,
            subheader: runRecord.trigger_subheader ?? undefined,
            url: runRecord.trigger_url ?? undefined
        },
        filtered: runRecord.filtered,
        decision: {
            action: runRecord.decision_action,
            reasoning: runRecord.decision_reason
        },
        actions: mapActions(runRecord.actions),
        status: convertPrismaRunHistoryStatusToShared(runRecord.status),
        isManuallyTriggered: runRecord.is_manually_triggered
    }))
    return { items, total }
}

function formatTriggerPayloadForDisplay(payload: Prisma.JsonValue | null): TriggerPayload {
    if (payload === null) {
        return { triggerEvent: null, triggerEventType: null, isTriggerEventTruncated: false }
    }
    const parsedPayload = JSON.parse(payload as string)
    const serializedEvent = serializedEventSchema.parse(parsedPayload)
    const triggerEventType = serializedEvent.eventType
    const eventJson = JSON.stringify(serializedEvent, null, 2)
    if (!eventJson) {
        return { triggerEvent: null, triggerEventType, isTriggerEventTruncated: false }
    }
    if (eventJson.length <= MAX_TRIGGER_PAYLOAD_RESPONSE_CHARS) {
        return { triggerEvent: eventJson, triggerEventType, isTriggerEventTruncated: false }
    }
    return {
        triggerEvent: eventJson.slice(0, MAX_TRIGGER_PAYLOAD_RESPONSE_CHARS) + "\n... (truncated)",
        triggerEventType,
        isTriggerEventTruncated: true
    }
}

export async function fetchChatHistoryForRun(runId: string, organizationId: string) {
    const runRecord = await findRunRecordForChat(runId, organizationId)
    if (!runRecord) throw new RunNotFoundError()

    const modelEvents = await getRunHistoryModelEventsWithActions(runId, { includeScaffoldedUserMessages: false })
    const events: RunHistoryModelEvent[] = modelEvents.map((event, index) => ({
        ...event,
        id: event.id ?? `run-history-raw-${index}`,
        timestamp: event.timestamp
    }))

    const { triggerEvent, triggerEventType, isTriggerEventTruncated } = formatTriggerPayloadForDisplay(runRecord.trigger_payload)

    return {
        events,
        startTimestamp: runRecord.timestamp.toISOString(),
        endTimestamp: runRecord.updated_at.toISOString(),
        status: runRecord.status,
        triggerEvent,
        triggerEventType,
        isTriggerEventTruncated
    }
}

export async function fetchActionsByIds(ids: string[], organizationId: string) {
    if (ids.length === 0) return []
    const actions = await findActionsByIdsInOrg(ids, organizationId)
    return actions.map(action => ({
        id: action.id,
        action: action.action,
        integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
        step_id: action.step_id ?? undefined
    }))
}
