import path from "node:path"

export const MEMORY_ROOT = "/memories"

const CONTAINMENT_BASE = "/__memory__"

type MemoryPathSource = "model" | "relative"

/**
 * Resolve a memory path to a volume-relative path inside the automation subtree.
 * `model` paths must be under /memories; `relative` paths are CLI/API paths rooted at the job memory dir.
 */
export function resolveMemoryVolumePath(params: { subtreeKey: string; inputPath: unknown; source: MemoryPathSource }): string | null {
    const rawPath = normalizeRawPath(params.inputPath)
    if (rawPath === null || rawPath.includes("\0")) return null

    const relative = params.source === "model" ? stripMemoryRoot(rawPath) : rawPath.replace(/^\/+/, "")
    if (relative === null) return null

    const resolved = path.posix.resolve(CONTAINMENT_BASE, relative)
    if (resolved !== CONTAINMENT_BASE && !resolved.startsWith(`${CONTAINMENT_BASE}/`)) return null

    const within = resolved.slice(CONTAINMENT_BASE.length).replace(/^\/+/, "")
    return within === "" ? params.subtreeKey : `${params.subtreeKey}/${within}`
}

function normalizeRawPath(inputPath: unknown): string | null {
    if (inputPath == null) return ""
    return typeof inputPath === "string" ? inputPath : null
}

function stripMemoryRoot(modelPath: string): string | null {
    if (modelPath === MEMORY_ROOT || modelPath === `${MEMORY_ROOT}/`) return ""
    if (modelPath.startsWith(`${MEMORY_ROOT}/`)) return modelPath.slice(MEMORY_ROOT.length + 1)
    return null
}
