import { getAgentVolumeStore, agentFilesVolumeName, formatHumanSize } from "../../services/volumeStore"
import type { VolumeFileEntry } from "../../services/volumeStore"

export type FileCommand = "list" | "read" | "write" | "delete"

export type FileCommandInput = {
    command: FileCommand
    path?: string | null
    content?: string | null
}

export type FileCommandResult = {
    success: true
    message: string
    entries?: VolumeFileEntry[]
    content?: string
}

export async function executeFileCommand(organizationId: string, agentId: string, input: FileCommandInput): Promise<FileCommandResult> {
    const store = getAgentVolumeStore()
    const volumeName = agentFilesVolumeName(organizationId, agentId)

    switch (input.command) {
        case "list": {
            const entries = await store.list(volumeName, input.path ?? "")
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
            const content = await store.read(volumeName, input.path)
            return { success: true, message: `Read ${input.path}`, content }
        }
        case "write": {
            if (!input.path || input.content === undefined || input.content === null) {
                throw new Error("write requires path and content")
            }
            await store.write(volumeName, input.path, input.content)
            return { success: true, message: `Wrote file ${input.path}` }
        }
        case "delete": {
            if (!input.path) {
                throw new Error("delete requires path")
            }
            await store.deletePath(volumeName, input.path)
            return { success: true, message: `Deleted ${input.path}` }
        }
        default: {
            const exhaustive: never = input.command
            throw new Error(`Unsupported file command: ${exhaustive}`)
        }
    }
}
