import { RunHistoryStatus } from "terse-types"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { getKvStore } from "../../common/kvStore"
import { db } from "../../loaders/prisma"

import { TestRunContext, mintTestRunRecord } from "./testRunContext"

/**
 * A single `terse test` invocation is one SSE session (the CLI sends X-Terse-Session-Id on every
 * agent-run and tool-execute call). We mint ONE is_test run per session and reuse it across all agent
 * and deterministic tool calls, so a test doesn't explode into a run row per call. The run is finalized
 * when the session stream tears down. Stored in the shared KvStore (swap to Redis when multi-instance).
 */
type SessionTestRun = { runId: string; agentId: string }

const SESSION_TTL_MS = 60 * 60 * 1000
const kvKey = (sessionId: string): string => `sdk:test-run-session:${sessionId}`

export async function getOrCreateSessionTestRun(sessionId: string, user: UserSession, testCtx: TestRunContext): Promise<SessionTestRun> {
    const kv = getKvStore()
    const key = kvKey(sessionId)
    const existing = await kv.get<SessionTestRun>(key)
    if (existing) return existing

    const run = await mintTestRunRecord(user, testCtx)
    await kv.set(key, run, SESSION_TTL_MS)
    return run
}

/** Finalize the session's test run (success only if still in progress; an earlier error may have failed it). */
export async function finalizeSessionTestRun(sessionId: string): Promise<void> {
    const kv = getKvStore()
    const key = kvKey(sessionId)
    const run = await kv.get<SessionTestRun>(key)
    if (!run) return
    await kv.delete(key)
    try {
        await db().run_history_records.updateMany({
            where: { id: run.runId, status: RunHistoryStatus.IN_PROGRESS },
            data: { status: RunHistoryStatus.SUCCESS }
        })
    } catch (error) {
        logger.warn("[sdk] finalizeSessionTestRun failed, continuing", { sessionId, error })
    }
}
