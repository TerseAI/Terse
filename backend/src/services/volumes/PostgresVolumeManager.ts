import crypto from "crypto"

import { db } from "../../loaders/prisma"
import { SandboxVolume } from "../sandboxProvider/SandboxService"

import { VolumeManager } from "./VolumeManager"
import { VolumeDirEntry, VolumeFs } from "./types"

/**
 * VolumeManager backed by Postgres. Memory + typed state are stored as a content-addressed blob table
 * (`memory_blobs`) plus a live tree (`memory_entries`). There is no sandbox and no mount: every op is a
 * query, so out-of-band access (CLI, dashboard, purge) no longer spins up an ephemeral sandbox.
 *
 * Incoming paths are volume-relative `subtreeKey/within` (see resolveMemoryVolumePath). The first segment
 * is the subtree (which carries the prod/test namespace); the rest is the within-subtree path.
 */
export class PostgresVolumeManager implements VolumeManager {
    async getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume> {
        // No physical volume to create; memory lives in Postgres. Returned only for interface parity.
        return projectId
    }

    async deleteProjectVolume(projectId: string): Promise<void> {
        await db().memory_entries.deleteMany({ where: { project_id: projectId } })
        await db().memory_snapshots.deleteMany({ where: { project_id: projectId } })
    }

    async openProjectVolumeFs(projectId: string, _runId?: string): Promise<VolumeFs> {
        return new PostgresVolumeFs(projectId)
    }
}

class PostgresVolumeFs implements VolumeFs {
    constructor(private readonly projectId: string) {}

    async list(dirPath: string): Promise<VolumeDirEntry[]> {
        const { subtreeKey, within } = splitRel(dirPath)
        if (!subtreeKey) return []
        const prefix = within ? `${within}/` : ""
        const rows = await db().memory_entries.findMany({
            where: { project_id: this.projectId, subtree_key: subtreeKey, ...(prefix ? { path: { startsWith: prefix } } : {}) },
            select: { path: true, size_bytes: true }
        })

        const files = new Map<string, number>()
        const dirs = new Set<string>()
        for (const row of rows) {
            const rest = prefix ? row.path.slice(prefix.length) : row.path
            if (rest === "") continue
            const slash = rest.indexOf("/")
            if (slash === -1) {
                files.set(rest, row.size_bytes)
            } else {
                dirs.add(rest.slice(0, slash))
            }
        }

        const out: VolumeDirEntry[] = []
        for (const name of dirs) out.push({ name, isDirectory: true, sizeBytes: 0 })
        for (const [name, sizeBytes] of files) {
            if (!dirs.has(name)) out.push({ name, isDirectory: false, sizeBytes })
        }
        return out
    }

    async read(filePath: string): Promise<string | null> {
        const { subtreeKey, within } = splitRel(filePath)
        if (!subtreeKey || !within) return null
        const entry = await db().memory_entries.findUnique({
            where: { project_id_subtree_key_path: { project_id: this.projectId, subtree_key: subtreeKey, path: within } },
            select: { blob_hash: true }
        })
        if (!entry) return null
        const blob = await db().memory_blobs.findUnique({ where: { hash: entry.blob_hash }, select: { content: true } })
        return blob?.content ?? null
    }

    async write(filePath: string, content: string): Promise<void> {
        const { subtreeKey, within } = splitRel(filePath)
        if (!subtreeKey || !within) throw new Error(`Cannot write to a subtree root: ${filePath}`)
        const hash = blobHash(content)
        const sizeBytes = Buffer.byteLength(content, "utf8")
        await db().$transaction([
            db().memory_blobs.upsert({ where: { hash }, create: { hash, content, size_bytes: sizeBytes }, update: {} }),
            db().memory_entries.upsert({
                where: { project_id_subtree_key_path: { project_id: this.projectId, subtree_key: subtreeKey, path: within } },
                create: { project_id: this.projectId, subtree_key: subtreeKey, path: within, blob_hash: hash, size_bytes: sizeBytes },
                update: { blob_hash: hash, size_bytes: sizeBytes }
            })
        ])
    }

    async stat(path: string): Promise<{ isDirectory: boolean; sizeBytes: number } | null> {
        const { subtreeKey, within } = splitRel(path)
        if (!subtreeKey) return null
        if (!within) {
            const count = await db().memory_entries.count({ where: { project_id: this.projectId, subtree_key: subtreeKey } })
            return count > 0 ? { isDirectory: true, sizeBytes: 0 } : null
        }
        const file = await db().memory_entries.findUnique({
            where: { project_id_subtree_key_path: { project_id: this.projectId, subtree_key: subtreeKey, path: within } },
            select: { size_bytes: true }
        })
        if (file) return { isDirectory: false, sizeBytes: file.size_bytes }
        const childCount = await db().memory_entries.count({
            where: { project_id: this.projectId, subtree_key: subtreeKey, path: { startsWith: `${within}/` } }
        })
        return childCount > 0 ? { isDirectory: true, sizeBytes: 0 } : null
    }

    async remove(path: string): Promise<void> {
        const { subtreeKey, within } = splitRel(path)
        if (!subtreeKey) return
        if (!within) {
            await db().memory_entries.deleteMany({ where: { project_id: this.projectId, subtree_key: subtreeKey } })
            return
        }
        await db().memory_entries.deleteMany({
            where: {
                project_id: this.projectId,
                subtree_key: subtreeKey,
                OR: [{ path: within }, { path: { startsWith: `${within}/` } }]
            }
        })
    }

    async rename(fromPath: string, toPath: string): Promise<void> {
        const from = splitRel(fromPath)
        const to = splitRel(toPath)
        if (!from.subtreeKey || !from.within || !to.subtreeKey || !to.within) {
            throw new Error(`Unsupported rename: ${fromPath} -> ${toPath}`)
        }
        const rows = await db().memory_entries.findMany({
            where: {
                project_id: this.projectId,
                subtree_key: from.subtreeKey,
                OR: [{ path: from.within }, { path: { startsWith: `${from.within}/` } }]
            },
            select: { id: true, path: true }
        })
        await db().$transaction(
            rows.map(row => {
                const newWithin = row.path === from.within ? to.within : `${to.within}${row.path.slice(from.within.length)}`
                return db().memory_entries.update({
                    where: { id: row.id },
                    data: { subtree_key: to.subtreeKey, path: newWithin }
                })
            })
        )
    }

    async mkdirp(_dirPath: string): Promise<void> {
        // Directories are implicit (derived from entry paths); nothing to create.
    }

    async sync(): Promise<void> {
        // Postgres is durable on commit.
    }

    async dispose(): Promise<void> {
        // No ephemeral resources.
    }
}

function splitRel(rel: string): { subtreeKey: string; within: string } {
    const clean = rel.replace(/^\/+/, "").replace(/\/+$/, "")
    const idx = clean.indexOf("/")
    if (idx === -1) return { subtreeKey: clean, within: "" }
    return { subtreeKey: clean.slice(0, idx), within: clean.slice(idx + 1) }
}

function blobHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}
