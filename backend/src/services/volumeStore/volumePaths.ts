import crypto from "node:crypto"
import path from "node:path"

export const AGENT_FILES_VOLUME_PREFIX = "sdk-agent-"
export const AGENT_MEMORY_VOLUME_PREFIX = "sdk-agent-mem-"

export const AGENT_FILES_MOUNT_PATH = "/mnt/agent-volume"
export const AGENT_MEMORY_MOUNT_PATH = "/mnt/agent-memory"

export const MEMORY_ROOT = "/memories"

export function agentFilesVolumeName(agentId: string): string {
    return `${AGENT_FILES_VOLUME_PREFIX}${agentId}`
}

export function agentMemoryVolumeName(agentId: string): string {
    return `${AGENT_MEMORY_VOLUME_PREFIX}${agentId}`
}

export function volumeUtilitySandboxName(volumeName: string): string {
    const digest = crypto.createHash("sha256").update(volumeName).digest("hex").slice(0, 24)
    return `volacc-${digest}`
}

export function resolveVolumeRelativePath(inputPath: string, options?: { requiredPrefix?: string }): string {
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

    let relative = segments.join("/")
    if (options?.requiredPrefix) {
        const prefix = options.requiredPrefix.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")
        if (prefix.length > 0) {
            if (relative.length === 0) {
                relative = prefix
            } else if (relative === prefix || relative.startsWith(`${prefix}/`)) {
                // already under prefix
            } else {
                relative = `${prefix}/${relative}`
            }
        }
    }

    const resolved = path.posix.normalize(relative === "" ? "." : relative)
    if (resolved === ".." || resolved.startsWith("../")) {
        throw new Error("Path traversal is not allowed.")
    }

    return resolved === "." ? "" : resolved
}

export function joinVolumePath(relativePath: string): string {
    if (!relativePath) return "."
    return relativePath
}
