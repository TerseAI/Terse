import os from "node:os"
import path from "node:path"

export const MEMORY_ROOT = "/memories"

// Subdirectories under the co-located root. Memory and filesystem are unified on one
// store/volume; they only differ by subtree.
export const MEMORY_SUBDIR = "memories"
export const FILES_SUBDIR = "files"

/**
 * Resolve the co-located base directory that memory/filesystem operate against.
 * Inside a Modal sandbox this is the mounted volume path (set by the backend via TERSE_FS_ROOT).
 * For local development (no mount) it falls back to a temp directory so Path B still works.
 */
export function resolveFsRoot(): string {
    const fromEnv = process.env.TERSE_FS_ROOT
    if (fromEnv && fromEnv.trim().length > 0) {
        return fromEnv.trim()
    }
    return path.join(os.tmpdir(), "terse-memoryfs")
}

export function resolveRelativePath(inputPath: string): string {
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
