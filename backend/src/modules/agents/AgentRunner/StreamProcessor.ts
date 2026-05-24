import { Server } from "socket.io"
import { ModelEvent } from "terse-types"
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent, TrackingParams } from "terse-types"
import { SocketEvents, SocketRooms } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../../common/logger"
import { randomString } from "../../../common/strings"

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

    emit(event: ModelEvent, timestamp: number): void {
        if (!this.io) return
        const runHistoryModelEvent: RunHistoryModelEvent = {
            ...event,
            id: event.id ?? randomString(15),
            timestamp: event.timestamp ?? timestamp
        }

        const payload: RunHistoryModelSocketEvent = {
            runId: this.runId,
            agentId: this.agentId,
            runHistoryModelEvent
        }

        this.io.to(this.room).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
    }
}
