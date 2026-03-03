import type { RunStreamEvent } from "@openai/agents"
import type { AgentInputItem, Session } from "@openai/agents-core"
import { createHash } from "crypto"

import logger from "../logger"
import { db } from "../prismaClient"
import { RunHistoryMemory } from "../rag/runHistoryRag/indexer"
import { RunHistoryRawEventWithRelations } from "../types/prisma"
import { RAGNamespace } from "../types/rag"

type BaseMemorySessionOptions = {
    sessionId: string
    skipSave?: boolean
    filterIncompleteToolCalls?: boolean
}

interface RunHistoryChatMemorySessionOptions extends BaseMemorySessionOptions {}

interface ChatMemorySessionOptions extends BaseMemorySessionOptions {
    sessionId: string // chat_session_id from chat_sessions table
}

type CompletedAssistantTextMap = Map<string, Map<number, string>>
type PendingFunctionCallsMap = Map<string, AgentInputItem>
type CompletedFunctionCallIdsSet = Set<string>

type StoredRawEvent = {
    id: string
    rawEvent: AgentInputItem
}

type RawEventStorageStrategy = {
    getItems(sessionId: string, limit?: number): Promise<AgentInputItem[]>
    upsertByEventKey(sessionId: string, eventKey: string, item: AgentInputItem, sequenceOrder: number): Promise<void>
    getLatestItem(sessionId: string): Promise<StoredRawEvent | null>
    deleteById(id: string): Promise<void>
    clear(sessionId: string): Promise<void>
    getMaxSequenceOrder(sessionId: string): Promise<number | null>
}

const runHistoryStorageStrategy: RawEventStorageStrategy = {
    async getItems(sessionId, limit) {
        const prisma = db()
        const items = await prisma.run_history_raw_events.findMany({
            where: {
                run_history_record_id: sessionId
            },
            orderBy: [
                { sequence_order: "asc" },
                { created_at: "asc" } // Fallback for items without sequence_order (backward compatibility)
            ],
            take: limit,
            select: {
                raw_event_json: true
            }
        })
        return items.map(item => item.raw_event_json as AgentInputItem)
    },

    async upsertByEventKey(sessionId, eventKey, item, sequenceOrder) {
        const prisma = db()
        await prisma.run_history_raw_events.upsert({
            where: {
                run_history_record_id_event_key: {
                    run_history_record_id: sessionId,
                    event_key: eventKey
                }
            },
            update: {
                raw_event_json: item as any
            },
            create: {
                run_history_record_id: sessionId,
                event_key: eventKey,
                raw_event_json: item as any,
                sequence_order: sequenceOrder
            }
        })
    },

    async getLatestItem(sessionId) {
        const prisma = db()
        const lastEvent = await prisma.run_history_raw_events.findFirst({
            where: {
                run_history_record_id: sessionId
            },
            orderBy: [
                { sequence_order: "desc" },
                { created_at: "desc" } // Fallback for items without sequence_order (backward compatibility)
            ]
        })
        if (!lastEvent) {
            return null
        }
        return {
            id: lastEvent.id,
            rawEvent: lastEvent.raw_event_json as AgentInputItem
        }
    },

    async deleteById(id) {
        const prisma = db()
        await prisma.run_history_raw_events.delete({
            where: {
                id
            }
        })
    },

    async clear(sessionId) {
        const prisma = db()
        await prisma.run_history_raw_events.deleteMany({
            where: {
                run_history_record_id: sessionId
            }
        })
    },

    async getMaxSequenceOrder(sessionId) {
        const prisma = db()
        const maxSequence = await prisma.run_history_raw_events.findFirst({
            where: {
                run_history_record_id: sessionId
            },
            orderBy: {
                sequence_order: "desc"
            },
            select: {
                sequence_order: true
            }
        })
        return maxSequence?.sequence_order ?? null
    }
}

const chatStorageStrategy: RawEventStorageStrategy = {
    async getItems(sessionId, limit) {
        const prisma = db()
        const items = await prisma.chat_raw_events.findMany({
            where: {
                chat_session_id: sessionId
            },
            orderBy: [
                { sequence_order: "asc" },
                { created_at: "asc" } // Fallback for items without sequence_order (backward compatibility)
            ],
            take: limit,
            select: {
                raw_event_json: true
            }
        })
        return items.map(item => item.raw_event_json as AgentInputItem)
    },

    async upsertByEventKey(sessionId, eventKey, item, sequenceOrder) {
        const prisma = db()
        await prisma.chat_raw_events.upsert({
            where: {
                chat_session_id_event_key: {
                    chat_session_id: sessionId,
                    event_key: eventKey
                }
            },
            update: {
                raw_event_json: item as any
            },
            create: {
                chat_session_id: sessionId,
                event_key: eventKey,
                raw_event_json: item as any,
                sequence_order: sequenceOrder
            }
        })
    },

    async getLatestItem(sessionId) {
        const prisma = db()
        const lastEvent = await prisma.chat_raw_events.findFirst({
            where: {
                chat_session_id: sessionId
            },
            orderBy: [
                { sequence_order: "desc" },
                { created_at: "desc" } // Fallback for items without sequence_order (backward compatibility)
            ]
        })
        if (!lastEvent) {
            return null
        }
        return {
            id: lastEvent.id,
            rawEvent: lastEvent.raw_event_json as AgentInputItem
        }
    },

    async deleteById(id) {
        const prisma = db()
        await prisma.chat_raw_events.delete({
            where: {
                id
            }
        })
    },

    async clear(sessionId) {
        const prisma = db()
        await prisma.chat_raw_events.deleteMany({
            where: {
                chat_session_id: sessionId
            }
        })
    },

    async getMaxSequenceOrder(sessionId) {
        const prisma = db()
        const maxSequence = await prisma.chat_raw_events.findFirst({
            where: {
                chat_session_id: sessionId
            },
            orderBy: {
                sequence_order: "desc"
            },
            select: {
                sequence_order: true
            }
        })
        return maxSequence?.sequence_order ?? null
    }
}

export type StreamEventIngestionSession = {
    ingestStreamEvent(event: RunStreamEvent): Promise<void>
}

class BaseChatMemorySession implements Session {
    private readonly sessionId: string
    private readonly skipSave: boolean
    private readonly filterIncompleteToolCalls: boolean
    private readonly storage: RawEventStorageStrategy
    private readonly completedAssistantTextByItemId: CompletedAssistantTextMap = new Map()
    private readonly pendingFunctionCallsByCallId: PendingFunctionCallsMap = new Map()
    private readonly completedFunctionCallIds: CompletedFunctionCallIdsSet = new Set()

    constructor(options: BaseMemorySessionOptions, storage: RawEventStorageStrategy) {
        this.sessionId = options.sessionId
        this.skipSave = options.skipSave ?? false
        this.filterIncompleteToolCalls = options.filterIncompleteToolCalls ?? false
        this.storage = storage
    }

    async getSessionId(): Promise<string> {
        return this.sessionId
    }

    async getItems(limit?: number): Promise<AgentInputItem[]> {
        const rawEvents = await this.storage.getItems(this.sessionId, limit)
        const filteredEvents = filterReasoningItems(rawEvents)
        const deduplicatedEvents = deduplicateItemsById(filteredEvents)
        const filteredToolCallEvents = this.filterIncompleteToolCalls ? filterToolCallEvents(deduplicatedEvents) : deduplicatedEvents
        return filteredToolCallEvents.map(cloneAgentItem)
    }

    async addItems(items: AgentInputItem[]): Promise<void> {
        await this.addItemsWithEventKeys(items)
    }

    async addItemsWithEventKeys(items: AgentInputItem[]): Promise<void> {
        if (this.skipSave) return
        if (items.length === 0) return

        let nextSequenceOrder = await this.getNextSequenceOrder()
        for (const item of items) {
            const eventKey = buildAgentInputItemEventKey(item)
            await this.storage.upsertByEventKey(this.sessionId, eventKey, item, nextSequenceOrder++)
        }
    }

    async upsertItemByEventKey(item: AgentInputItem, eventKey: string): Promise<void> {
        if (this.skipSave) return
        await this.storage.upsertByEventKey(this.sessionId, eventKey, item, await this.getNextSequenceOrder())
    }

    async ingestStreamEvent(event: RunStreamEvent): Promise<void> {
        if (this.skipSave) return
        await ingestStreamEventToSession(event, {
            completedAssistantTextByItemId: this.completedAssistantTextByItemId,
            pendingFunctionCallsByCallId: this.pendingFunctionCallsByCallId,
            completedFunctionCallIds: this.completedFunctionCallIds,
            upsertItemByEventKey: (item, eventKey) => this.upsertItemByEventKey(item, eventKey)
        })
    }

    async popItem(): Promise<AgentInputItem | undefined> {
        if (this.skipSave) return undefined
        const lastEvent = await this.storage.getLatestItem(this.sessionId)
        if (!lastEvent) {
            return undefined
        }
        const cloned = cloneAgentItem(lastEvent.rawEvent)
        await this.storage.deleteById(lastEvent.id)
        return cloned
    }

    async clearSession(): Promise<void> {
        if (this.skipSave) return
        await this.storage.clear(this.sessionId)
    }

    private async getNextSequenceOrder(): Promise<number> {
        const maxSequenceOrder = await this.storage.getMaxSequenceOrder(this.sessionId)
        return (maxSequenceOrder ?? -1) + 1
    }
}

/**
 * Inspired by the CustomMemorySession in the OpenAI agents library
 * https://openai.github.io/openai-agents-js/guides/sessions/#bring-your-own-storage
 *
 * Session implementation for run history records (uses run_history_raw_events table)
 */
export class RunHistoryChatMemorySession extends BaseChatMemorySession {
    constructor(options: RunHistoryChatMemorySessionOptions) {
        super(options, runHistoryStorageStrategy)
    }
}

/**
 * Session implementation for general chat sessions (uses chat_raw_events table)
 * For chats not tied to run history records (e.g., Slack threads, direct chats)
 */
export class ChatMemorySession extends BaseChatMemorySession {
    constructor(options: ChatMemorySessionOptions) {
        super(options, chatStorageStrategy)
    }
}

type IngestStreamEventOptions = {
    completedAssistantTextByItemId: CompletedAssistantTextMap
    pendingFunctionCallsByCallId: PendingFunctionCallsMap
    completedFunctionCallIds: CompletedFunctionCallIdsSet
    upsertItemByEventKey: (item: AgentInputItem, eventKey: string) => Promise<void>
}

async function ingestStreamEventToSession(event: RunStreamEvent, options: IngestStreamEventOptions): Promise<void> {
    if (event.type === "run_item_stream_event") {
        await persistRunItemStreamEvent(event, options)
        return
    }

    const completedTextSegment = tryExtractCompletedTextSegment(event)
    if (!completedTextSegment) return

    const { itemId, contentIndex, text } = completedTextSegment
    await persistCompletedAssistantTextSegment(itemId, contentIndex, text, options)
}

async function persistRunItemStreamEvent(event: RunStreamEvent & { type: "run_item_stream_event" }, options: IngestStreamEventOptions): Promise<void> {
    const rawItem = (event as any)?.item?.rawItem
    if (!isAgentInputItemRecord(rawItem)) {
        return
    }

    // Keep aligned with SDK persistence semantics: approval placeholders are not persisted as raw output items.
    if ((event as any).item?.type === "tool_approval_item") {
        return
    }

    const clonedRawItem = cloneAgentItem(rawItem as AgentInputItem)

    const clonedAny = clonedRawItem as any
    const itemType = typeof clonedAny?.type === "string" ? clonedAny.type : ""
    const callId = typeof clonedAny?.callId === "string" ? clonedAny.callId.trim() : ""

    // Do not persist function_call stream items until a matching function_call_result arrives.
    if (itemType === "function_call" && callId) {
        if (options.completedFunctionCallIds.has(callId)) {
            // If result has already been observed (out-of-order stream), persist immediately.
            const completedCallEventKey = buildAgentInputItemEventKey(clonedRawItem)
            await options.upsertItemByEventKey(clonedRawItem, completedCallEventKey)
            return
        }

        options.pendingFunctionCallsByCallId.set(callId, clonedRawItem)
        return
    }

    if (itemType === "function_call_result" && callId) {
        options.completedFunctionCallIds.add(callId)

        const pendingFunctionCall = options.pendingFunctionCallsByCallId.get(callId)
        if (pendingFunctionCall) {
            const pendingCallEventKey = buildAgentInputItemEventKey(pendingFunctionCall)
            await options.upsertItemByEventKey(pendingFunctionCall, pendingCallEventKey)
            options.pendingFunctionCallsByCallId.delete(callId)
        }

        const functionResultEventKey = buildAgentInputItemEventKey(clonedRawItem)
        await options.upsertItemByEventKey(clonedRawItem, functionResultEventKey)
        return
    }

    const eventKey = buildAgentInputItemEventKey(clonedRawItem)
    await options.upsertItemByEventKey(clonedRawItem, eventKey)

    if (clonedRawItem.type === "message" && clonedRawItem.role === "assistant" && typeof (clonedRawItem as any).id === "string") {
        options.completedAssistantTextByItemId.delete((clonedRawItem as any).id)
    }
}

type CompletedTextSegment = {
    itemId: string
    contentIndex: number
    text: string
}

function tryExtractCompletedTextSegment(event: RunStreamEvent): CompletedTextSegment | null {
    if (event.type !== "raw_model_stream_event" || (event as any).data?.type !== "model" || (event as any).data?.event?.type !== "response.output_text.done") {
        return null
    }

    const eventData = (event as any).data.event
    const itemId = typeof eventData?.item_id === "string" ? eventData.item_id.trim() : ""
    const text = typeof eventData?.text === "string" ? eventData.text : ""
    const contentIndexValue = Number.isInteger(eventData?.content_index) ? Number(eventData.content_index) : 0

    if (!itemId || !text) return null

    return {
        itemId,
        contentIndex: Math.max(0, contentIndexValue),
        text
    }
}

async function persistCompletedAssistantTextSegment(itemId: string, contentIndex: number, text: string, options: IngestStreamEventOptions): Promise<void> {
    const existingParts = options.completedAssistantTextByItemId.get(itemId) ?? new Map<number, string>()
    existingParts.set(contentIndex, text)
    options.completedAssistantTextByItemId.set(itemId, existingParts)

    const content = Array.from(existingParts.entries())
        .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
        .map(([, segmentText]) => ({
            type: "output_text" as const,
            text: segmentText
        }))

    const snapshotItem: AgentInputItem = {
        type: "message",
        id: itemId,
        role: "assistant",
        status: "in_progress",
        content
    } as AgentInputItem

    const eventKey = buildAgentInputItemEventKey(snapshotItem)
    await options.upsertItemByEventKey(snapshotItem, eventKey)
}

function isAgentInputItemRecord(value: unknown): value is AgentInputItem {
    return typeof value === "object" && value !== null
}

export function buildAgentInputItemEventKey(item: AgentInputItem): string {
    const itemAny = item as any
    const itemType = typeof itemAny?.type === "string" ? itemAny.type : ""
    const itemId = typeof itemAny?.id === "string" ? itemAny.id.trim() : ""
    const callId = typeof itemAny?.callId === "string" ? itemAny.callId.trim() : ""
    const role = typeof itemAny?.role === "string" ? itemAny.role : ""

    if (itemType === "message" && role === "assistant") {
        if (itemId) {
            return `msg:${itemId}`
        }
        return `hash:${hashAgentInputItem(item)}`
    }

    if (itemType === "function_call" && callId) {
        return `fc:${callId}`
    }

    if (itemType === "function_call_result" && callId) {
        return `fcr:${callId}`
    }

    if (itemType === "reasoning" && itemId) {
        return `rs:${itemId}`
    }

    if (callId && itemType) {
        return `${itemType}:${callId}`
    }

    return `hash:${hashAgentInputItem(item)}`
}

function hashAgentInputItem(item: AgentInputItem): string {
    const normalized = normalizeValueForHash(item)
    const serialized = JSON.stringify(normalized)
    return createHash("sha256").update(serialized).digest("hex")
}

function normalizeValueForHash(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value
    }

    if (typeof value === "bigint") {
        return value.toString()
    }

    if (value instanceof Uint8Array) {
        return {
            __type: "Uint8Array",
            data: Buffer.from(value).toString("base64")
        }
    }

    if (Array.isArray(value)) {
        return value.map(entry => normalizeValueForHash(entry))
    }

    if (typeof value !== "object") {
        return value
    }

    const normalizedRecord: Record<string, unknown> = {}
    const record = value as Record<string, unknown>
    const sortedKeys = Object.keys(record).sort()

    for (const key of sortedKeys) {
        normalizedRecord[key] = normalizeValueForHash(record[key])
    }

    return normalizedRecord
}

function filterReasoningItems(rawEvents: AgentInputItem[]): AgentInputItem[] {
    const filteredEvents: AgentInputItem[] = []
    for (let i = 0; i < rawEvents.length; i++) {
        const item = rawEvents[i]
        const isReasoningItemVariable = isReasoningItem(item)

        if (isReasoningItemVariable) {
            // Check if there's a following message item
            const hasFollowingMessage = i < rawEvents.length - 1 && isMessageItem(rawEvents[i + 1])
            const hasFollowingWebSearchCall = i < rawEvents.length - 1 && isWebSearchCallItem(rawEvents[i + 1])
            if (hasFollowingMessage || hasFollowingWebSearchCall) {
                // Include the reasoning item - it has its required following message
                filteredEvents.push(item)
            } else {
                // Skip this reasoning item as it doesn't have a required following item
                logger.info(`[ChannelAgent] Skipping reasoning item at index ${i} - no following message item`)
            }
        } else {
            // Not a reasoning item, include it normally
            filteredEvents.push(item)
        }
    }
    return filteredEvents
}

function isReasoningItem(item: AgentInputItem): boolean {
    // Reasoning items typically have a type property set to 'reasoning' or an id starting with 'rs_'
    if (typeof item === "object" && item !== null) {
        const itemAny = item as any
        // Check for reasoning item indicators
        if (itemAny.type === "reasoning") {
            return true
        }
        if (itemAny.id && typeof itemAny.id === "string" && itemAny.id.startsWith("rs_")) {
            return true
        }
    }
    return false
}

function isMessageItem(item: AgentInputItem): boolean {
    // Message items have a 'role' property (user, assistant, system)
    if (typeof item === "object" && item !== null) {
        const itemAny = item as any
        return itemAny.role === "user" || itemAny.role === "assistant" || itemAny.role === "system"
    }
    return false
}

function isWebSearchCallItem(item: AgentInputItem): boolean {
    // Web search call items have type 'web_search_call' or id starting with 'ws_'
    if (typeof item === "object" && item !== null) {
        const itemAny = item as any
        if (itemAny.type === "web_search_call") {
            return true
        }
        if (itemAny.id && typeof itemAny.id === "string" && itemAny.id.startsWith("ws_")) {
            return true
        }
    }
    return false
}

function isUserMessage(item: AgentInputItem): boolean {
    return item.type === "message" && item.role === "user"
}

export function trimToLastTurns(items: AgentInputItem[], maxTurns: number): AgentInputItem[] {
    if (items.length === 0) return items
    maxTurns = Math.max(1, maxTurns)

    let count = 0
    let startIdx = 0

    for (let i = items.length - 1; i >= 0; i--) {
        if (isUserMessage(items[i])) {
            count++
            if (count === maxTurns) {
                startIdx = i
                break
            }
        }
    }

    return items.slice(startIdx)
}

function cloneAgentItem<T extends AgentInputItem>(item: T): T {
    return structuredClone(item)
}

/**
 * Deduplicates items by their ID, keeping only the last occurrence of each ID.
 * This prevents duplicate item errors when sending items to the OpenAI API.
 */
function deduplicateItemsById(items: AgentInputItem[]): AgentInputItem[] {
    // Track the last index where each ID appears
    const idToLastIndex = new Map<string, number>()

    for (let i = 0; i < items.length; i++) {
        const itemAny = items[i]
        if (itemAny?.id && typeof itemAny.id === "string") {
            idToLastIndex.set(itemAny.id, i)
        }
    }

    // If no IDs found, no duplicates possible
    if (idToLastIndex.size === 0) {
        return items
    }

    // Filter to keep only items that are either:
    // 1. The last occurrence of their ID, or
    // 2. Don't have an ID
    const result: AgentInputItem[] = items
        .map((item, i) => {
            const itemId = item?.id
            if (!itemId || typeof itemId !== "string") return item
            if (idToLastIndex.get(itemId) === i) return item
            return undefined
        })
        .filter(item => item !== undefined)

    return result
}

export const recentHistoryCallback = (history: AgentInputItem[], newItems: AgentInputItem[]): AgentInputItem[] => {
    const trimmedHistory = trimToLastTurns(history, 10)
    return [...trimmedHistory, ...newItems]
}

export const identityHistoryCallback = (history: AgentInputItem[], newItems: AgentInputItem[]): AgentInputItem[] => {
    return [...history, ...newItems]
}

const filterToolCallEvents = (events: AgentInputItem[]): AgentInputItem[] => {
    // Track function_call events by callId
    const functionCallsByCallId = new Map<string, AgentInputItem>()
    // Track function_call_result events by callId
    const functionCallResultsByCallId = new Map<string, AgentInputItem>()

    // First pass: collect all function_call and function_call_result events
    for (const event of events) {
        const eventAny = event as any

        if (eventAny?.type === "function_call" && eventAny?.callId) {
            const callId = eventAny.callId
            // Keep the last occurrence if there are duplicates
            functionCallsByCallId.set(callId, event)
        } else if (eventAny?.type === "function_call_result" && eventAny?.callId) {
            const callId = eventAny.callId
            // Keep the last occurrence if there are duplicates
            functionCallResultsByCallId.set(callId, event)
        }
    }

    // Second pass: filter events to only include:
    // 1. function_call events that have a matching function_call_result
    // 2. function_call_result events that have a matching function_call
    // 3. All other events (non-function-call events)
    const filteredEvents: AgentInputItem[] = []

    for (const event of events) {
        const eventAny = event as any

        if (eventAny?.type === "function_call" && eventAny?.callId) {
            const callId = eventAny.callId
            // Only include if there's a corresponding function_call_result
            if (functionCallResultsByCallId.has(callId)) {
                filteredEvents.push(event)
            } else {
                logger.info(`[filterToolCallEvents] Filtering out function_call without result: ${eventAny.name} (callId: ${callId})`)
            }
        } else if (eventAny?.type === "function_call_result" && eventAny?.callId) {
            const callId = eventAny.callId
            // Only include if there's a corresponding function_call
            if (functionCallsByCallId.has(callId)) {
                filteredEvents.push(event)
            } else {
                logger.info(`[filterToolCallEvents] Filtering out function_call_result without call: ${eventAny.name} (callId: ${callId})`)
            }
        } else {
            // Include all other events (not function_call or function_call_result)
            filteredEvents.push(event)
        }
    }

    return filteredEvents
}

/**
 * Keeping around for now, but not using it. We will want to test this in depth before
 * introducing this additional complexity.
 */
async function persistLongTermMemory(events: RunHistoryRawEventWithRelations[], userId: string): Promise<void> {
    const longTermMemory = new RunHistoryMemory(userId, RAGNamespace.RUN_HISTORY_MEMORY)
    await longTermMemory.rememberBulk(events)
}
