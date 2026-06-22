import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

import { type FileCommandInput, type FileCommandResult, MUTATING_FILE_COMMANDS, executeFileCommand } from "./file.js"
import { MUTATING_MEMORY_COMMANDS, type MemoryCommandInput, type MemoryCommandResult, executeMemoryCommand } from "./memory.js"
import { FILES_SUBDIR, MEMORY_SUBDIR, resolveFsRoot } from "./paths.js"
import { LocalFsStore } from "./store.js"

export { LocalFsStore } from "./store.js"
export type { FsEntry } from "./store.js"
export { executeMemoryCommand, type MemoryCommand, type MemoryCommandInput, type MemoryCommandResult } from "./memory.js"
export { executeFileCommand, type FileCommand, type FileCommandInput, type FileCommandResult } from "./file.js"
export { MEMORY_ROOT, resolveFsRoot } from "./paths.js"

/** Tool names that resolve against the co-located filesystem instead of the backend. */
export const MEMORY_FS_TOOL_NAMES = ["memory", "file"] as const
export type MemoryFsToolName = (typeof MEMORY_FS_TOOL_NAMES)[number]

export function isMemoryFsTool(toolName: string): toolName is MemoryFsToolName {
    return (MEMORY_FS_TOOL_NAMES as readonly string[]).includes(toolName)
}

const execFileAsync = promisify(execFile)

/**
 * Commit pending writes to the backing Modal volume. On Volumes v2 `sync <mountpoint>`
 * flushes and commits, so changes become visible to other containers. Gated by
 * TERSE_FS_COMMIT (set by the backend only when running on a mounted volume); a no-op for
 * local-dev where writes already live on the dev machine's disk.
 */
async function commitMount(mountPath: string): Promise<void> {
    if (process.env.TERSE_FS_COMMIT !== "1") return
    try {
        await execFileAsync("sync", [mountPath])
    } catch {
        try {
            await execFileAsync("sync", [])
        } catch {
            // best-effort: fall back to Modal's background commit
        }
    }
}

export type MemoryFsRequest = { tool: "memory"; input: MemoryCommandInput } | { tool: "file"; input: FileCommandInput }

export type MemoryFsResult = MemoryCommandResult | FileCommandResult

/**
 * Single entry point used by both reach-back paths. Resolves the co-located root, runs the
 * command against the local filesystem, and commits the volume after a mutating op.
 */
export async function runMemoryFsCommand(request: MemoryFsRequest): Promise<MemoryFsResult> {
    const root = resolveFsRoot()

    if (request.tool === "memory") {
        const store = new LocalFsStore(path.join(root, MEMORY_SUBDIR))
        const result = await executeMemoryCommand(store, request.input)
        if (MUTATING_MEMORY_COMMANDS.has(request.input.command)) {
            await commitMount(root)
        }
        return result
    }

    const store = new LocalFsStore(path.join(root, FILES_SUBDIR))
    const result = await executeFileCommand(store, request.input)
    if (MUTATING_FILE_COMMANDS.has(request.input.command)) {
        await commitMount(root)
    }
    return result
}
