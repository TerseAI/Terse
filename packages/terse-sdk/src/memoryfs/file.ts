import { formatHumanSize } from "./paths.js"
import type { FsEntry, LocalFsStore } from "./store.js"

export type FileCommand = "list" | "read" | "write" | "delete"

export type FileCommandInput = {
    command: FileCommand
    path?: string | null
    content?: string | null
}

export type FileCommandResult = {
    success: true
    message: string
    entries?: FsEntry[]
    content?: string
}

export async function executeFileCommand(store: LocalFsStore, input: FileCommandInput): Promise<FileCommandResult> {
    switch (input.command) {
        case "list": {
            const entries = await store.list(input.path ?? "")
            if (entries.length === 0) {
                return { success: true, message: `Directory ${input.path || "/"} is empty.`, entries: [] }
            }
            const listing = entries.map(entry => `${formatHumanSize(entry.sizeBytes)}\t${entry.path}${entry.isDirectory ? "/" : ""}`).join("\n")
            return { success: true, message: `Files in ${input.path || "/"}:\n${listing}`, entries }
        }
        case "read": {
            if (!input.path) {
                throw new Error("read requires path")
            }
            const content = await store.read(input.path)
            return { success: true, message: `Read ${input.path}`, content }
        }
        case "write": {
            if (!input.path || input.content === undefined || input.content === null) {
                throw new Error("write requires path and content")
            }
            await store.write(input.path, input.content)
            return { success: true, message: `Wrote file ${input.path}` }
        }
        case "delete": {
            if (!input.path) {
                throw new Error("delete requires path")
            }
            await store.deletePath(input.path)
            return { success: true, message: `Deleted ${input.path}` }
        }
        default: {
            const exhaustive: never = input.command
            throw new Error(`Unsupported file command: ${exhaustive}`)
        }
    }
}

export const MUTATING_FILE_COMMANDS: ReadonlySet<FileCommand> = new Set(["write", "delete"])
