import { Request, Response } from "express"
import { SdkStateGetResponse, sdkStateGetRequestSchema, sdkStatePutRequestSchema } from "terse-types/types"

import { db } from "../../../loaders/prisma"
import { resolveMemoryVolumePath } from "../../../services/memory/memoryPaths"
import { stateSubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { getVolumeManager } from "../../../services/volumes"

type StateScope = { projectId: string; runId: string; subtreeKey: string }

async function resolveStateScope(req: Request, res: Response): Promise<StateScope | null> {
    const user = req.session?.user
    if (!user?.organizationId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }

    const headerRunId = (req.headers["x-terse-run-id"] as string | undefined)?.trim()
    if (!headerRunId) {
        res.status(400).json({ success: false, error: "Job state requires an active run context (X-Terse-Run-Id)" })
        return null
    }
    const run = await db().run_history_records.findFirst({
        where: { id: headerRunId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, is_test: true, automation: { select: { project_id: true } } }
    })
    if (!run) {
        res.status(404).json({ success: false, error: "Run not found" })
        return null
    }
    return { projectId: run.automation.project_id, runId: run.id, subtreeKey: stateSubtreeKey(run.automation_id, run.is_test) }
}

function resolveStateKeyPath(subtreeKey: string, key: string): string | null {
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: `${key}.json`, source: "relative" })
    if (rel === null || rel === subtreeKey) return null
    return rel
}

export async function handleStateGet(req: Request, res: Response) {
    const scope = await resolveStateScope(req, res)
    if (!scope) return

    const parsed = sdkStateGetRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "key (non-empty string) is required" })
    const rel = resolveStateKeyPath(scope.subtreeKey, parsed.data.key)
    if (!rel) return res.status(400).json({ success: false, error: "A valid state key is required" })

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId, scope.runId)
    try {
        const content = await fs.read(rel)
        const response: SdkStateGetResponse = { content: content ?? null }
        return res.json(response)
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleStatePut(req: Request, res: Response) {
    const scope = await resolveStateScope(req, res)
    if (!scope) return

    const parsed = sdkStatePutRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "key (non-empty string) and content (string) are required" })
    const rel = resolveStateKeyPath(scope.subtreeKey, parsed.data.key)
    if (!rel) return res.status(400).json({ success: false, error: "A valid state key is required" })

    const fs = await getVolumeManager().openProjectVolumeFs(scope.projectId, scope.runId)
    try {
        await fs.write(rel, parsed.data.content)
        await fs.sync()
        return res.json({ success: true })
    } finally {
        await fs.dispose().catch(() => {})
    }
}
