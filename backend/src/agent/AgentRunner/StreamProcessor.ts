import { Server } from "socket.io"

import logger from "../../logger"
import { ModelEvent } from "../../shared/ModelEvents"
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent, TrackingParams } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { User } from "../../shared/types"
import { randomString } from "../../utility/strings"
import { nextRunStreamSequence } from "../streamSequence"

export class StreamEventEmitter {
    private io: Server | null
    private room: string
    private runId: string
    private agentId: string

    constructor(io: Server | null, params: TrackingParams) {
        this.io = io
        if (!params.user.organizationId) {
            throw new Error("organizationId is required for StreamEventEmitter")
        }
        this.room = SocketRooms.organization(params.user.organizationId)
        this.runId = params.runId!
        this.agentId = params.agentId!
    }

    emit(event: ModelEvent, timestamp: number): string {
        const eventId = randomString(15)
        if (!this.io) return eventId
        const runHistoryModelEvent: RunHistoryModelEvent = {
            ...event,
            id: eventId
        }

        const payload: RunHistoryModelSocketEvent = {
            runId: this.runId,
            agentId: this.agentId,
            runHistoryModelEvent
        }

        this.io.to(this.room).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
        return eventId
    }
}

export async function processModelEventStream(eventStream: AsyncGenerator<ModelEvent, void, unknown>, options: StreamProcessorOptions): Promise<void> {
    const emitter = new StreamEventEmitter(options.io, {
        runId: options.runId,
        agentId: options.agentId,
        user: options.user
    })

    try {
        for await (const event of eventStream) {
            const timestamp = Date.now()
            emitter.emit(event, timestamp)
        }
    } catch (error) {
        logger.error("Error processing model event stream", { error, runId: options.runId, userId: options.user.id, agentId: options.agentId })
        throw error
    }
}

export interface StreamProcessorOptions {
    runId: string
    agentId: string
    user: User
    io: Server | null
}
