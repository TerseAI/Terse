import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { memorySubtreeKey, stateSubtreeKey } from "../sdkSandboxLayerKeys"

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Default snapshot retention. Per-run snapshots older than this are swept. */
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 30

/**
 * Retention (ms) for a snapshot being captured. Global for now; the seam for future per-scope config.
 * To honor the reserved `projects.snapshot_retention_days` override later, read it here and fall back to the default.
 */
export function resolveSnapshotTtlMs(_params: { projectId: string }): number {
    return DEFAULT_SNAPSHOT_RETENTION_DAYS * MS_PER_DAY
}

export async function captureRunSnapshot(params: { runId: string; projectId: string; automationId: string; isTest: boolean }): Promise<void> {
    const { runId, projectId, automationId, isTest } = params
    const subtrees = [memorySubtreeKey(automationId, isTest), stateSubtreeKey(automationId, isTest)]
    try {
        const entries = await db().memory_entries.findMany({
            where: { project_id: projectId, subtree_key: { in: subtrees } },
            select: { subtree_key: true, path: true, blob_hash: true }
        })
        if (entries.length === 0) return
        await db().memory_snapshots.create({
            data: {
                run_id: runId,
                project_id: projectId,
                automation_id: automationId,
                is_test: isTest,
                expires_at: new Date(Date.now() + resolveSnapshotTtlMs({ projectId })),
                entries: { create: entries.map(e => ({ subtree_key: e.subtree_key, path: e.path, blob_hash: e.blob_hash })) }
            }
        })
    } catch (error) {
        logger.warn("memory snapshot: capture failed", { runId, error })
    }
}

export async function restoreRunSnapshotInto(params: { originalRunId: string; projectId: string; targetMemorySubtreeKey: string; targetStateSubtreeKey: string }): Promise<boolean> {
    const { originalRunId, projectId, targetMemorySubtreeKey, targetStateSubtreeKey } = params
    const snapshot = await db().memory_snapshots.findUnique({
        where: { run_id: originalRunId },
        select: { automation_id: true, is_test: true, entries: { select: { subtree_key: true, path: true, blob_hash: true } } }
    })
    if (!snapshot) return false

    const originalStateSubtree = stateSubtreeKey(snapshot.automation_id, snapshot.is_test)
    const hashes = [...new Set(snapshot.entries.map(e => e.blob_hash))]
    const blobs = await db().memory_blobs.findMany({ where: { hash: { in: hashes } }, select: { hash: true, size_bytes: true } })
    const sizeByHash = new Map(blobs.map(b => [b.hash, b.size_bytes]))

    const rows = snapshot.entries.map(e => ({
        project_id: projectId,
        subtree_key: e.subtree_key === originalStateSubtree ? targetStateSubtreeKey : targetMemorySubtreeKey,
        path: e.path,
        blob_hash: e.blob_hash,
        size_bytes: sizeByHash.get(e.blob_hash) ?? 0
    }))
    if (rows.length > 0) {
        await db().memory_entries.createMany({ data: rows, skipDuplicates: true })
    }
    return true
}

/** Delete the live entries for the given subtrees (used to GC a replay's isolated namespace). */
export async function deleteSubtrees(projectId: string, subtreeKeys: string[]): Promise<void> {
    if (subtreeKeys.length === 0) return
    await db().memory_entries.deleteMany({ where: { project_id: projectId, subtree_key: { in: subtreeKeys } } })
}

export async function sweepExpiredMemorySnapshots(): Promise<{ deletedSnapshots: number; deletedBlobs: number }> {
    const deleted = await db().memory_snapshots.deleteMany({ where: { expires_at: { lt: new Date() } } })
    const deletedBlobs = await db().$executeRawUnsafe(
        `DELETE FROM "memory_blobs" AS b
         WHERE NOT EXISTS (SELECT 1 FROM "memory_entries" e WHERE e."blob_hash" = b."hash")
           AND NOT EXISTS (SELECT 1 FROM "memory_snapshot_entries" se WHERE se."blob_hash" = b."hash")`
    )
    return { deletedSnapshots: deleted.count, deletedBlobs }
}
