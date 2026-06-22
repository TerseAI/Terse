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

// Runtime sandboxes are scoped per project (so identical-source projects never share a container)
// and per source-layer body (so a code change spins a fresh one). Every run and the prewarm for a
// project share this one name; whether the project volume is mounted is decided project-wide.
export function runtimeSandboxUniqueName(sourceLayerKey: string, projectId?: string): string {
    const body = sourceLayerKeyHexBody(sourceLayerKey)
    if (!projectId) return `sr-${body}`
    const projectSuffix = crypto.createHash("sha256").update(projectId).digest("hex").slice(0, 12)
    return `sr-${body}-${projectSuffix}`
}
