import crypto from "node:crypto"
import path from "node:path"

export const MEMORY_ROOT = "/memories"

// Org is folded into the volume name as a fixed-length hash so volumes are namespaced per
// organization while staying within Modal's object-name length limit (org ids + cuids would
// otherwise overflow). The agentId stays readable for ops/debugging.
function orgSegment(organizationId: string): string {
    return crypto.createHash("sha256").update(organizationId).digest("hex").slice(0, 12)
}

export function agentFilesVolumeName(organizationId: string, agentId: string): string {
    return `sdk-${orgSegment(organizationId)}-agent-${agentId}`
}

export function agentMemoryVolumeName(organizationId: string, agentId: string): string {
    return `sdk-${orgSegment(organizationId)}-agent-mem-${agentId}`
}

/**
 * The single co-located volume mounted into a project's shared sandbox. Memory and
 * filesystem live as subtrees on this one volume (unified store, shared across all of the
 * project's jobs). Keyed by project so it persists across deploys (sandbox identity changes
 * with code; the volume does not).
 */
export function projectVolumeName(organizationId: string, projectId: string): string {
    return `sdk-${orgSegment(organizationId)}-proj-${projectId}`
}

/** Mount path of the project volume inside the sandbox; the co-located memory/FS root. */
export const PROJECT_VOLUME_MOUNT = "/terse-fs"

export function resolveVolumeRelativePath(inputPath: string): string {
    const normalized = inputPath.replace(/\\/g, "/").trim()
    if (!normalized) {
        throw new Error("Path is required.")
    }

    const withoutLeadingSlash = normalized.startsWith("/") ? normalized.slice(1) : normalized
    if (withoutLeadingSlash.includes("\0")) {
        throw new Error("Invalid path.")
    }

    const segments = withoutLeadingSlash.split("/").filter(segment => segment.length > 0)
    if (segments.some(segment => segment === "..")) {
        throw new Error("Path traversal is not allowed.")
    }

    const resolved = path.posix.normalize(segments.join("/") || ".")
    if (resolved === ".." || resolved.startsWith("../")) {
        throw new Error("Path traversal is not allowed.")
    }

    return resolved === "." ? "" : resolved
}

export function formatHumanSize(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes}B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}K`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}M`
}
