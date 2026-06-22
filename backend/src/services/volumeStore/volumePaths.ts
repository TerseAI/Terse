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

export function volumeUtilitySandboxName(volumeName: string): string {
    const digest = crypto.createHash("sha256").update(volumeName).digest("hex").slice(0, 24)
    return `volacc-${digest}`
}

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
