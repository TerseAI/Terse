import { Request, Response } from "express"
import {
    SdkStateGetResponse,
    SdkStateListResponse,
    SdkStateReadResponse,
    SdkStateResetResponse,
    SdkStateScopeRequest,
    sdkStateGetRequestSchema,
    sdkStateKeyRequestSchema,
    sdkStatePutRequestSchema,
    sdkStateScopeRequestSchema
} from "terse-types/types"

import { db } from "../../../loaders/prisma"
import { resolveMemoryVolumePath } from "../../../services/memory/memoryPaths"
import { replayStateSubtreeKey, stateSubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { VolumeManagerProvider } from "../../../services/volumes"
import { settings } from "../../../settings"
import { userOwnsProject } from "../testRunContext"

import { listStateKeys, resetJobTestState } from "./service"

const DEPLOYED_STATE_READ_ONLY = "Deployed state is read-only from the CLI. Pass --test to target the test state used by `terse test` runs."

type StateScope = { projectId: string; runId: string; subtreeKey: string }
type StateAdminScope = { projectId: string; jobName: string; automationId: string; subtreeKey: string }

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
        select: { id: true, automation_id: true, is_test: true, replay_of_run_id: true, automation: { select: { project_id: true } } }
    })
    if (!run) {
        res.status(404).json({ success: false, error: "Run not found" })
        return null
    }
    const subtreeKey = settings.modal && run.replay_of_run_id ? replayStateSubtreeKey(run.id) : stateSubtreeKey(run.automation_id, run.is_test)
    return { projectId: run.automation.project_id, runId: run.id, subtreeKey }
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

    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(scope.projectId, scope.runId)
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

    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(scope.projectId, scope.runId)
    try {
        await fs.write(rel, parsed.data.content)
        await fs.sync()
        return res.json({ success: true })
    } finally {
        await fs.dispose().catch(() => {})
    }
}

// CLI-facing state routes. Unlike the run-scoped get/put above, these resolve the job by
// projectId + jobName (no run context) and target the deployed or test lane via `test`.

async function resolveStateAdminScope(req: Request, res: Response, data: SdkStateScopeRequest): Promise<StateAdminScope | null> {
    const user = req.session?.user
    if (!user?.organizationId) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return null
    }
    const projectId = await userOwnsProject(data.projectId, user)
    if (!projectId) {
        res.status(404).json({ success: false, error: "Project not found" })
        return null
    }
    const isTest = data.test === true
    const automation = await db().automations.findFirst({
        where: { name: data.jobName, organization_id: user.organizationId, project_id: projectId, ...(isTest ? {} : { deployed_at: { not: null } }) },
        select: { id: true }
    })
    if (!automation) {
        res.status(404).json({ success: false, error: `No state for job "${data.jobName}" yet. Run \`terse test\` or deploy it first.` })
        return null
    }
    return { projectId, jobName: data.jobName, automationId: automation.id, subtreeKey: stateSubtreeKey(automation.id, isTest) }
}

export async function handleStateList(req: Request, res: Response) {
    const parsed = sdkStateScopeRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "projectId and jobName are required" })
    const scope = await resolveStateAdminScope(req, res, parsed.data)
    if (!scope) return

    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(scope.projectId)
    try {
        const keys = await listStateKeys(fs, scope.subtreeKey)
        const response: SdkStateListResponse = { job: scope.jobName, keys }
        return res.json(response)
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleStateRead(req: Request, res: Response) {
    const parsed = sdkStateKeyRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "projectId, jobName and key are required" })
    const scope = await resolveStateAdminScope(req, res, parsed.data)
    if (!scope) return

    const rel = resolveStateKeyPath(scope.subtreeKey, parsed.data.key)
    if (!rel) return res.status(400).json({ success: false, error: "A valid state key is required" })

    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(scope.projectId)
    try {
        const content = await fs.read(rel)
        if (content === null) return res.status(404).json({ success: false, error: `No state value for key "${parsed.data.key}"` })
        const response: SdkStateReadResponse = { key: parsed.data.key, content }
        return res.json(response)
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleStateDelete(req: Request, res: Response) {
    const parsed = sdkStateKeyRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "projectId, jobName and key are required" })
    if (parsed.data.test !== true) return res.status(400).json({ success: false, error: DEPLOYED_STATE_READ_ONLY })
    const scope = await resolveStateAdminScope(req, res, parsed.data)
    if (!scope) return

    const rel = resolveStateKeyPath(scope.subtreeKey, parsed.data.key)
    if (!rel) return res.status(400).json({ success: false, error: "A valid state key is required" })

    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(scope.projectId)
    try {
        const stat = await fs.stat(rel)
        if (!stat) return res.status(404).json({ success: false, error: `No state value for key "${parsed.data.key}"` })
        await fs.remove(rel)
        await fs.sync()
        return res.json({ success: true })
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function handleStateReset(req: Request, res: Response) {
    const parsed = sdkStateScopeRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "projectId and jobName are required" })
    if (parsed.data.test !== true) return res.status(400).json({ success: false, error: DEPLOYED_STATE_READ_ONLY })
    const scope = await resolveStateAdminScope(req, res, parsed.data)
    if (!scope) return

    const deleted = await resetJobTestState(scope.projectId, scope.automationId)
    const response: SdkStateResetResponse = { deleted }
    return res.json(response)
}
