import type { AnyEventRequest, CreateEventParams, EventResult } from "@workflow/world"
import type { DirectHandler } from "@workflow/world-local"
import { AsyncLocalStorage } from "node:async_hooks"
import { format } from "node:util"
import { z } from "zod"

import type { TerseWorld } from "../../terseWorld.js"

// The runtime drives a whole run inside one queue delivery: it replays the
// workflow body top-down once per step suspension, so console calls outside
// steps repeat once per replay pass. Each pass re-emits a prefix of the
// previous pass's calls; suppressing that matching prefix prints each line once.
export function withReplayLogDedupe(handler: DirectHandler): DirectHandler {
    return async req => {
        const runId = await peekRunId(req)
        if (!runId) return handler(req)
        return ReplayLogDeduper.getInstance().runWithDedupe(runId, () => handler(req))
    }
}

// Steps run once (results are journaled), so their logs must never be deduped.
// The local queue invokes handlers inside the async context that enqueued the
// message (for steps that is the workflow delivery itself), so exit it explicitly.
export function withoutReplayLogDedupe(handler: DirectHandler): DirectHandler {
    return async req => ReplayLogDeduper.getInstance().runOutsideDedupe(() => handler(req))
}

// The runtime reloads the run's event journal at the start of every replay
// pass, and writes journal events only once a pass is past replay (committing
// a suspension, starting a step). Those two world calls delimit exactly the
// replayed portion of each pass, which is the only output dedupe may touch.
export function withReplayPassSignals(world: TerseWorld): TerseWorld {
    return { ...world, events: tapEvents(world.events) }
}

const WorkflowInvokePayload = z.object({ runId: z.string() })

async function peekRunId(req: Request): Promise<string | null> {
    try {
        const payload = WorkflowInvokePayload.safeParse(await req.clone().json())
        return payload.success ? payload.data.runId : null
    } catch {
        return null
    }
}

function tapEvents(events: TerseWorld["events"]): TerseWorld["events"] {
    return {
        ...events,
        list: params => {
            ReplayLogDeduper.getInstance().markReplayPassStart(params.runId)
            return events.list(params)
        },
        create: (runId: string | null, data: AnyEventRequest, params?: CreateEventParams): Promise<EventResult> => {
            if (data.eventType === "run_created") return events.create(runId, data, params)
            if (runId === null) throw new Error(`events.create requires a runId for "${data.eventType}" events`)
            // run_started is the first delivery's bootstrap write and precedes
            // the first replay; every other event commits post-replay work.
            if (data.eventType !== "run_started") ReplayLogDeduper.getInstance().markPastReplay(runId)
            return events.create(runId, data, params)
        }
    }
}

const CONSOLE_LEVELS = ["log", "info", "warn", "error"] as const

const MAX_TRACKED_RUNS = 256

class ReplayLogDeduper {
    private static instance: ReplayLogDeduper | null = null

    static getInstance(): ReplayLogDeduper {
        return (ReplayLogDeduper.instance ??= new ReplayLogDeduper())
    }

    private readonly deliveryStorage = new AsyncLocalStorage<RunDeliveryState>()
    private readonly seenCallsByRun = new Map<string, SeenConsoleCall[]>()
    private activeDeliveries = 0
    private restoreConsole: (() => void) | null = null

    private constructor() {}

    async runWithDedupe<T>(runId: string, fn: () => Promise<T>): Promise<T> {
        this.enterDelivery()
        try {
            const state: RunDeliveryState = { runId, seenCalls: this.seenCallsFor(runId), cursor: 0, pastReplay: false }
            return await this.deliveryStorage.run(state, fn)
        } finally {
            this.leaveDelivery()
        }
    }

    runOutsideDedupe<T>(fn: () => Promise<T>): Promise<T> {
        return this.deliveryStorage.exit(fn)
    }

    markReplayPassStart(runId: string): void {
        const state = this.deliveryStorage.getStore()
        if (!state || state.runId !== runId) return
        state.cursor = 0
        state.pastReplay = false
    }

    markPastReplay(runId: string): void {
        const state = this.deliveryStorage.getStore()
        if (!state || state.runId !== runId) return
        state.pastReplay = true
    }

    // The console filter is installed only while a delivery is in flight, and
    // over whatever methods are current: `terse test` intercepts console for
    // its spinner UI, and dedupe must wrap that interception, not replace it.
    private enterDelivery(): void {
        this.activeDeliveries++
        if (this.restoreConsole) return

        const original = { log: console.log, info: console.info, warn: console.warn, error: console.error }
        CONSOLE_LEVELS.forEach(level => {
            console[level] = (...args: unknown[]) => {
                if (this.shouldSuppress(level, format(...args))) return
                original[level](...args)
            }
        })
        this.restoreConsole = () => {
            CONSOLE_LEVELS.forEach(level => {
                console[level] = original[level]
            })
        }
    }

    private leaveDelivery(): void {
        this.activeDeliveries--
        if (this.activeDeliveries > 0) return
        this.restoreConsole?.()
        this.restoreConsole = null
    }

    private shouldSuppress(level: ConsoleLevel, text: string): boolean {
        const state = this.deliveryStorage.getStore()
        if (!state || state.pastReplay) return false

        const expected = state.seenCalls[state.cursor]
        if (expected && expected.level === level && expected.text === text) {
            state.cursor++
            return true
        }

        // A mismatch means the pass diverged from the recorded sequence
        // (e.g. a non-deterministic log); print from here on and re-record.
        if (state.cursor < state.seenCalls.length) state.seenCalls.length = state.cursor
        state.seenCalls.push({ level, text })
        state.cursor++
        return false
    }

    private seenCallsFor(runId: string): SeenConsoleCall[] {
        const existing = this.seenCallsByRun.get(runId)
        if (existing) return existing

        if (this.seenCallsByRun.size >= MAX_TRACKED_RUNS) {
            const oldestRunId = this.seenCallsByRun.keys().next().value
            if (oldestRunId !== undefined) this.seenCallsByRun.delete(oldestRunId)
        }
        const seenCalls: SeenConsoleCall[] = []
        this.seenCallsByRun.set(runId, seenCalls)
        return seenCalls
    }
}

type ConsoleLevel = (typeof CONSOLE_LEVELS)[number]

type SeenConsoleCall = {
    readonly level: ConsoleLevel
    readonly text: string
}

type RunDeliveryState = {
    readonly runId: string
    readonly seenCalls: SeenConsoleCall[]
    cursor: number
    pastReplay: boolean
}
