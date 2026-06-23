/**
 * Compute keys for sandbox layers, which respect constraints from sandbox provider regarding name shape
 * and provide stable reuse.
 */
import crypto from "crypto"

function hexHead(s: string, maxLen: number): string {
    const hex = s.replace(/[^a-fA-F0-9]/g, "")
    return hex.slice(0, maxLen)
}

function sourceLayerKeyHexBody(sourceLayerKey: string): string {
    if (sourceLayerKey.startsWith("src-")) {
        return hexHead(sourceLayerKey.slice(4), 32)
    }
    return hexHead(sourceLayerKey, 32)
}

export function computeSourceLayerKey(params: { organizationId: string; dependencyHash: string; sourceHash: string }): string {
    const digest = crypto.createHash("sha256").update(params.organizationId).update("\0").update(params.dependencyHash).update("\0").update(params.sourceHash).digest("hex").slice(0, 32)

    return `src-${digest}`
}

export function dependencyBuildSandboxUniqueName(dependencyHash: string): string {
    return `db-${hexHead(dependencyHash, 32)}`
}

export function sourceImageBuildSandboxUniqueName(sourceLayerKey: string): string {
    return `sb-${sourceLayerKeyHexBody(sourceLayerKey)}`
}

export function runtimeSandboxUniqueName(projectId: string, runId: string): string {
    const digest = crypto.createHash("sha256").update(projectId).update("\0").update(runId).digest("hex").slice(0, 32)
    return `sr-${digest}`
}

export const SDK_SANDBOX_APP_NAME = "terse-sdk-sandbox"

/** Mount point for the per-project memory volume inside executing runtime sandboxes. */
export const MEMORY_MOUNT_PATH = "/mnt/memory"

/** Name of the per-project persistent volume (Modal Volume / local dir). */
export function projectVolumeName(projectId: string): string {
    return `mem-${projectId}`
}

/** Name of the per-project isolated volume holding `terse test` memory, separate from production. */
export function testProjectVolumeName(projectId: string): string {
    return `mem-test-${projectId}`
}

/** Filesystem-safe per-job subtree key for test memory (job names are user-controlled). */
export function testMemorySubtreeKey(jobName: string): string {
    return `job-${crypto.createHash("sha256").update(jobName).digest("hex").slice(0, 32)}`
}
