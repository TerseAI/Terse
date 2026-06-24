import { Request, Response } from "express"
import { SdkMemoryFileEntry, SdkMemoryGetResponse, SdkMemoryListResponse } from "terse-types/types"

import logger from "../../../common/logger"
import { db } from "../../../loaders/prisma"
import { resolveMemoryVolumePath } from "../../../services/memory/memoryPaths"
import { testMemorySubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { VolumeFs, getVolumeManager } from "../../../services/volumes"
import { userOwnsProject } from "../testRunContext"

// Memory is partitioned per automation (one subtree per job within the project volume), so the routes
// resolve the job's automation and operate on its subtree. Paths are relative to the job's memory root.
// `test: true` targets the isolated `terse test` subtree instead of the deployed agent's production memory.
type MemoryScope = { projectId: string; jobName: string; subtreeKey: string }
const MAX_WALK_DEPTH = 16

async function resolveMemoryScope(req: Request, res: Response): Promise<MemoryScope | null> {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }
    const projectId = await userOwnsProject(req.body?.projectId, user)
    if (!projectId) {
        res.status(404).json({ success: false, error: "Project not found" })
        return null
    }
    const jobName = (req.body?.jobName as string | undefined)?.trim()
    if (!jobName) {
        res.status(400).json({ success: false, error: "jobName is required" })
        return null
    }
    const isTest = req.body?.test === true
    const automation = await db().automations.findFirst({
        where: { name: jobName, organization_id: user.organizationId, project_id: projectId, ...(isTest ? {} : { deployed_at: { not: null } }) },
        select: { id: true }
    })
    if (!automation) {
        res.status(404).json({ success: false, error: `No memory for job "${jobName}" yet. Run \`terse test\` or deploy it first.` })
        return null
    }
    const subtreeKey = isTest ? testMemorySubtreeKey(automation.id) : automation.id
    return { projectId, jobName, subtreeKey }
}

export async function handleMemoryList(req: Request, res: Response) {
    const scope = await resolveMemoryScope(req, res)
    if (!scope) return

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId)
    try {
        const files = await listSubtree(fs, scope.subtreeKey)
        const response: SdkMemoryListResponse = { job: scope.jobName, files }
        return res.json(response)
    } catch (error) {
        logger.warn("[sdk/memory/list] failed", { error, projectId: scope.projectId, jobName: scope.jobName })
        return res.status(500).json({ success: false, error: "Failed to list memory" })
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleMemoryGet(req: Request, res: Response) {
    const scope = await resolveMemoryScope(req, res)
    if (!scope) return

    const rel = resolveMemoryVolumePath({ subtreeKey: scope.subtreeKey, inputPath: req.body?.path, source: "relative" })
    if (rel === null || rel === scope.subtreeKey) return res.status(400).json({ success: false, error: "A valid file path is required" })

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId)
    try {
        const content = await fs.read(rel)
        if (content === null) return res.status(404).json({ success: false, error: `${req.body?.path} not found` })
        const response: SdkMemoryGetResponse = { path: String(req.body?.path), content }
        return res.json(response)
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleMemoryPut(req: Request, res: Response) {
    const scope = await resolveMemoryScope(req, res)
    if (!scope) return

    const rel = resolveMemoryVolumePath({ subtreeKey: scope.subtreeKey, inputPath: req.body?.path, source: "relative" })
    if (rel === null || rel === scope.subtreeKey) return res.status(400).json({ success: false, error: "A valid file path is required" })
    const content = req.body?.content
    if (typeof content !== "string") return res.status(400).json({ success: false, error: "content (string) is required" })

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId)
    try {
        await fs.write(rel, content)
        await fs.sync()
        logger.info("[sdk/memory/put] wrote memory file", { projectId: scope.projectId, jobName: scope.jobName, path: req.body?.path })
        return res.json({ success: true })
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleMemoryDelete(req: Request, res: Response) {
    const scope = await resolveMemoryScope(req, res)
    if (!scope) return

    const rel = resolveMemoryVolumePath({ subtreeKey: scope.subtreeKey, inputPath: req.body?.path, source: "relative" })
    if (rel === null || rel === scope.subtreeKey) return res.status(400).json({ success: false, error: "A valid file path is required" })

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId)
    try {
        const stat = await fs.stat(rel)
        if (!stat) return res.status(404).json({ success: false, error: `${req.body?.path} not found` })
        await fs.remove(rel)
        await fs.sync()
        logger.info("[sdk/memory/delete] deleted memory file", { projectId: scope.projectId, jobName: scope.jobName, path: req.body?.path })
        return res.json({ success: true })
    } finally {
        await fs.dispose().catch(() => {})
    }
}

async function listSubtree(fs: VolumeFs, subtreeKey: string): Promise<SdkMemoryFileEntry[]> {
    const out: SdkMemoryFileEntry[] = []
    const walk = async (relDir: string, depth: number): Promise<void> => {
        if (depth > MAX_WALK_DEPTH) return
        const volDir = relDir ? `${subtreeKey}/${relDir}` : subtreeKey
        let entries: Awaited<ReturnType<VolumeFs["list"]>>
        try {
            entries = await fs.list(volDir)
        } catch {
            return // subtree (or subdir) does not exist yet
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const childRel = relDir ? `${relDir}/${entry.name}` : entry.name
            out.push({ path: childRel, isDirectory: entry.isDirectory, sizeBytes: entry.sizeBytes })
            if (entry.isDirectory) await walk(childRel, depth + 1)
        }
    }
    await walk("", 0)
    return out
}
