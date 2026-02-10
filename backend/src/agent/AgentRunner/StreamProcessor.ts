import { Server } from "socket.io"

import logger from "../../logger"
import { ModelEvent } from "../../shared/ModelEvents"
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent, RunHistoryStreamingParams } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { randomString } from "../../utility/strings"

import { storeChatEvent } from "./runHistory"

export class TextDeltaAggregator {
    private accumulatedDeltas = new Map<string, AccumulatedDelta>()
    private lastStepId: string | null = null
    private runId: string

    constructor(runId: string) {
        this.runId = runId
    }

    accumulate(event: TextDeltaEvent, timestamp: number): AccumulatedDelta {
        const { step_id, delta } = event

        if (!this.accumulatedDeltas.has(step_id)) {
            this.accumulatedDeltas.set(step_id, { text: delta, firstTimestamp: timestamp })
        } else {
            const accumulated = this.accumulatedDeltas.get(step_id)!
            accumulated.text += delta
        }

        this.lastStepId = step_id
        return this.accumulatedDeltas.get(step_id)!
    }

    async commitStep(stepId: string): Promise<string | undefined> {
        const accumulated = this.accumulatedDeltas.get(stepId)
        if (!accumulated || accumulated.eventId) {
            return accumulated?.eventId
        }

        const finalEvent: ModelEvent = {
            type: "TextDelta",
            step_id: stepId,
            delta: accumulated.text
        }

        const timestamp = accumulated.firstTimestamp ? new Date(accumulated.firstTimestamp) : undefined
        const eventId = await storeChatEvent(this.runId, finalEvent, timestamp)
        accumulated.eventId = eventId

        this.accumulatedDeltas.delete(stepId)
        return eventId
    }

    async commitLastTextDeltaStep(): Promise<void> {
        if (this.lastStepId) {
            await this.commitStep(this.lastStepId)
        }
    }

    getEventId(stepId: string): string | undefined {
        return this.accumulatedDeltas.get(stepId)?.eventId
    }

    getLastStepId(): string | null {
        return this.lastStepId
    }

    async handleStepTransition(newStepId: string): Promise<void> {
        if (this.lastStepId && this.lastStepId !== newStepId) {
            await this.commitStep(this.lastStepId)
        }
    }
}

export class StreamEventEmitter {
    private io: Server | null
    private room: string
    private runId: string
    private agentId: string

    constructor(io: Server | null, params: RunHistoryStreamingParams) {
        this.io = io
        if (!params.organizationId) {
            throw new Error("organizationId is required for StreamEventEmitter")
        }
        this.room = SocketRooms.organization(params.organizationId)
        this.runId = params.runId!
        this.agentId = params.agentId!
    }

    emitTextDelta(event: TextDeltaEvent, timestamp: number, eventId: string = ""): void {
        if (!this.io) return

        const runHistoryModelEvent: RunHistoryModelEvent = {
            ...event,
            id: eventId,
            timestamp
        }

        const payload: RunHistoryModelSocketEvent = {
            runId: this.runId,
            agentId: this.agentId,
            runHistoryModelEvent
        }

        this.io.to(this.room).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
    }

    async storeAndEmit(event: ModelEvent, timestamp: number): Promise<string> {
        const eventId = await storeChatEvent(this.runId, event)

        if (this.io) {
            const runHistoryModelEvent: RunHistoryModelEvent = {
                ...event,
                id: eventId,
                timestamp
            }

            const payload: RunHistoryModelSocketEvent = {
                runId: this.runId,
                agentId: this.agentId,
                runHistoryModelEvent
            }
            this.io.to(this.room).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
        }

        return eventId
    }
}

export async function processModelEventStream(eventStream: AsyncGenerator<ModelEvent, void, unknown>, options: StreamProcessorOptions): Promise<void> {
    const aggregator = new TextDeltaAggregator(options.runId)
    const emitter = new StreamEventEmitter(options.io, {
        runId: options.runId,
        userId: options.userId,
        agentId: options.agentId,
        organizationId: options.organizationId
    })

    try {
        for await (const event of eventStream) {
            const timestamp = Date.now()

            if (event.type === "TextDelta") {
                await handleTextDeltaEvent(event, timestamp, aggregator, emitter)
            } else {
                await handleNonTextDeltaEvent(event, timestamp, aggregator, emitter)
            }
        }
        // Finalize any remaining steps at the end of the stream
        await aggregator.commitLastTextDeltaStep()
    } catch (error) {
        logger.error("Error processing model event stream", { error, runId: options.runId, userId: options.userId, agentId: options.agentId })
        throw error
    }
}

async function handleTextDeltaEvent(event: TextDeltaEvent, timestamp: number, aggregator: TextDeltaAggregator, emitter: StreamEventEmitter): Promise<void> {
    await aggregator.handleStepTransition(event.step_id)
    aggregator.accumulate(event, timestamp)
    const eventId = aggregator.getEventId(event.step_id) || randomString(15)
    emitter.emitTextDelta(event, timestamp, eventId)
}

async function handleNonTextDeltaEvent(event: ModelEvent, timestamp: number, aggregator: TextDeltaAggregator, emitter: StreamEventEmitter): Promise<void> {
    await aggregator.commitLastTextDeltaStep()
    await emitter.storeAndEmit(event, timestamp)
}

type TextDeltaEvent = Extract<ModelEvent, { type: "TextDelta" }>

type AccumulatedDelta = {
    text: string
    firstTimestamp: number
    eventId?: string
}

export interface StreamProcessorOptions {
    runId: string
    userId: string
    agentId: string
    organizationId: string
    io: Server | null
}
