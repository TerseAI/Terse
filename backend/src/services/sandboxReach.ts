import logger from "../common/logger"
import { getActiveDeployForProject } from "../common/projectHelper"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"

import { getSandboxProvider } from "./sandboxProvider"
import type { Sandbox } from "./sandboxProvider/SandboxService"
import { computeSourceLayerKey, runtimeSandboxUniqueName } from "./sdkSandboxLayerKeys"
import { PROJECT_VOLUME_MOUNT } from "./volumeStore/volumePaths"

export type MemoryFsTool = "memory" | "file"

type FsExecEnvelope = { success: true; result: unknown } | { success: false; error: string }

/**
 * Reach back into the live job sandbox to run a memory/filesystem command against its
 * co-located volume. Used by the backend tool dispatcher during an agent run (the agent loop
 * runs on the backend, away from the disk). Returns the parsed tool result, or null when the
 * caller should fall back (non-containerized runner or no live sandbox for this run).
 */
export async function reachBackMemoryFs(params: { organizationId: string; agentId: string; tool: MemoryFsTool; input: unknown }): Promise<unknown | null> {
    const provider = getSandboxProvider()
    if (!provider.supportsContainerizedRunners) {
        return null
    }

    const uniqueName = await resolveRuntimeSandboxUniqueName(params.organizationId, params.agentId)
    if (!uniqueName) {
        return null
    }

    const sandbox = await provider.findLiveSandbox(uniqueName)
    if (!sandbox) {
        logger.info("Memory/FS reach-back: no live sandbox for run; falling back", { agentId: params.agentId, uniqueName })
        return null
    }

    const cliBin = `${provider.getCliCachePath(sandbox)}/bin/terse`
    const payload = Buffer.from(JSON.stringify({ tool: params.tool, input: params.input }), "utf8").toString("base64")
    const command = `${shellQuote(cliBin)} __fs-exec ${shellQuote(payload)}`

    const { exitCode, stdout, stderr } = await execInSandbox(sandbox, command)
    const envelope = parseEnvelope(stdout)

    if (envelope?.success) {
        return envelope.result
    }
    if (envelope && !envelope.success) {
        throw new Error(envelope.error)
    }
    throw new Error(stderr.trim() || `Memory/FS reach-back failed (exit ${exitCode})`)
}

async function execInSandbox(sandbox: Sandbox, command: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = await sandbox.exec(["sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
        env: { TERSE_FS_ROOT: PROJECT_VOLUME_MOUNT, TERSE_FS_COMMIT: "1" }
    })
    const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
    const exitCode = await proc.wait()
    return { exitCode, stdout, stderr }
}

function parseEnvelope(stdout: string): FsExecEnvelope | null {
    const trimmed = stdout.trim()
    if (!trimmed) return null
    try {
        return JSON.parse(trimmed) as FsExecEnvelope
    } catch {
        return null
    }
}

/**
 * Resolve the unique name of the sandbox running this agent's project, mirroring how
 * SdkJobExecutionService names it: project → active deploy → source image → source layer key.
 */
async function resolveRuntimeSandboxUniqueName(organizationId: string, agentId: string): Promise<string | null> {
    const agent = await db().automations.findFirst({
        where: { id: agentId, organization_id: organizationId },
        select: { project_id: true }
    })
    if (!agent?.project_id) return null

    const deploy = await getActiveDeployForProject(agent.project_id)
    if (!deploy?.sdk_source_image_id) return null

    const sourceImage = await db().sdk_source_images.findUnique({
        where: { id: deploy.sdk_source_image_id },
        select: { organization_id: true, source_hash: true, dependency_image: { select: { dependency_hash: true } } }
    })
    if (!sourceImage) return null

    const sourceLayerKey = computeSourceLayerKey({
        organizationId: sourceImage.organization_id,
        dependencyHash: sourceImage.dependency_image.dependency_hash,
        sourceHash: sourceImage.source_hash
    })
    return runtimeSandboxUniqueName(sourceLayerKey)
}
