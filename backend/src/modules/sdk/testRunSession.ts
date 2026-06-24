import { RunHistoryStatus } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

import { TestRunContext, mintTestRunRecord } from "./testRunContext"

/**
 * A single `terse test` invocation is one SSE session (the CLI sends X-Terse-Session-Id on every
 * agent-run and tool-execute call). We mint ONE is_test run per session and reuse it across all agent
 * and deterministic tool calls, so a test doesn't explode into a run row per call. The run is finalized
 * when the session stream tears down.
 */
type SessionTestRun = { runId: string; agentId: string }

const SESSION_TTL_MS = 60 * 60 * 1000
const sessionRuns = new Map<string, { promise: Promise<SessionTestRun>; createdAt: number }>()

export async function getOrCreateSessionTestRun(sessionId: string, user: UserSession, testCtx: TestRunContext): Promise<SessionTestRun> {
    sweepExpired()
    const existing = sessionRuns.get(sessionId)
    if (existing) return existing.promise

    const promise = mintTestRunRecord(user, testCtx)
    sessionRuns.set(sessionId, { promise, createdAt: nowMs() })
    // If minting fails, evict so a later call in the same session can retry rather than reusing the rejection.
    promise.catch(() => sessionRuns.delete(sessionId))
    return promise
}

/** Finalize the session's test run (success only if still in progress; an earlier error may have failed it). */
export async function finalizeSessionTestRun(sessionId: string): Promise<void> {
    const entry = sessionRuns.get(sessionId)
    if (!entry) return
    sessionRuns.delete(sessionId)
    try {
        const { runId } = await entry.promise
        await db().run_history_records.updateMany({
            where: { id: runId, status: RunHistoryStatus.IN_PROGRESS },
            data: { status: RunHistoryStatus.SUCCESS }
        })
    } catch (error) {
        logger.warn("[sdk] finalizeSessionTestRun failed, continuing", { sessionId, error })
    }
}

function sweepExpired(): void {
    const cutoff = nowMs() - SESSION_TTL_MS
    for (const [sessionId, entry] of sessionRuns) {
        if (entry.createdAt < cutoff) sessionRuns.delete(sessionId)
    }
}

function nowMs(): number {
    return Date.now()
}
