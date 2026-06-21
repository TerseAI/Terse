import { getAgentVolumeStore, agentMemoryVolumeName, MEMORY_ROOT, resolveVolumeRelativePath } from "../../services/volumeStore"
import type { AgentVolumeStore } from "../../services/volumeStore"

export type MemoryCommand = "view" | "create" | "str_replace" | "insert" | "delete" | "rename"

export type MemoryCommandInput = {
    command: MemoryCommand
    path?: string
    view_range?: [number, number] | null
    file_text?: string
    old_str?: string
    new_str?: string
    insert_line?: number
    insert_text?: string
    old_path?: string
    new_path?: string
}

function formatHumanSize(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes}B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}K`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}M`
}

function memoryDisplayPath(relativePath: string): string {
    const normalized = relativePath.replace(/^\/+/, "")
    if (!normalized) return MEMORY_ROOT
    return `${MEMORY_ROOT}/${normalized}`
}

function resolveMemoryPath(inputPath: string): string {
    const trimmed = inputPath.trim()
    if (trimmed === MEMORY_ROOT || trimmed === `${MEMORY_ROOT}/`) {
        return ""
    }

    let pathPart = trimmed
    if (pathPart.startsWith(`${MEMORY_ROOT}/`)) {
        pathPart = pathPart.slice(MEMORY_ROOT.length + 1)
    } else if (pathPart.startsWith("/")) {
        pathPart = pathPart.slice(1)
    }

    return resolveVolumeRelativePath(pathPart)
}

function resolveMemoryPathOptional(inputPath: string | undefined): string {
    if (!inputPath || inputPath.trim().length === 0) {
        return ""
    }
    return resolveMemoryPath(inputPath)
}

function formatLineNumber(lineNumber: number): string {
    return String(lineNumber).padStart(6, " ")
}

async function listDirectoryView(store: AgentVolumeStore, volumeName: string, relativePath: string, displayPath: string): Promise<string> {
    const entries = await store.list(volumeName, relativePath)
    const lines = [`Here're the files and directories up to 2 levels deep in ${displayPath}, excluding hidden items and node_modules:`]

    const rootStat = relativePath ? await store.stat(volumeName, relativePath) : null
    lines.push(`${formatHumanSize(rootStat?.sizeBytes ?? 4096)}\t${displayPath}`)

    for (const entry of entries) {
        lines.push(`${formatHumanSize(entry.sizeBytes)}\t${memoryDisplayPath(entry.path)}${entry.isDirectory ? "" : ""}`)
        if (entry.isDirectory) {
            const children = await store.list(volumeName, entry.path)
            for (const child of children) {
                lines.push(`${formatHumanSize(child.sizeBytes)}\t${memoryDisplayPath(child.path)}`)
            }
        }
    }

    return lines.join("\n")
}

async function viewFile(store: AgentVolumeStore, volumeName: string, relativePath: string, displayPath: string, viewRange?: [number, number] | null): Promise<string> {
    const content = await store.read(volumeName, relativePath)
    const lines = content.split("\n")
    if (lines.length > 999_999) {
        return `File ${displayPath} exceeds maximum line limit of 999,999 lines.`
    }

    const start = viewRange?.[0] ?? 1
    const end = viewRange?.[1] ?? lines.length
    const selected = lines.slice(Math.max(start, 1) - 1, end)

    const body = selected.map((line, index) => `${formatLineNumber(start + index)}\t${line}`).join("\n")
    return `Here's the content of ${displayPath} with line numbers:\n${body}`
}

function snippetWithLineNumbers(content: string, centerLine: number, radius = 4): string {
    const lines = content.split("\n")
    const start = Math.max(centerLine - radius, 1)
    const end = Math.min(centerLine + radius, lines.length)
    return lines
        .slice(start - 1, end)
        .map((line, index) => `${formatLineNumber(start + index)}\t${line}`)
        .join("\n")
}

export async function executeMemoryCommand(agentId: string, input: MemoryCommandInput): Promise<{ success: true; message: string }> {
    const store = getAgentVolumeStore()
    const volumeName = agentMemoryVolumeName(agentId)

    switch (input.command) {
        case "view": {
            const relativePath = resolveMemoryPathOptional(input.path)
            const displayPath = memoryDisplayPath(relativePath)
            const exists = relativePath === "" ? true : await store.exists(volumeName, relativePath)
            if (!exists) {
                return { success: true, message: `The path ${displayPath} does not exist. Please provide a valid path.` }
            }

            const stat = relativePath === "" ? { isDirectory: true } : await store.stat(volumeName, relativePath)
            if (stat.isDirectory) {
                return { success: true, message: await listDirectoryView(store, volumeName, relativePath, displayPath) }
            }
            return { success: true, message: await viewFile(store, volumeName, relativePath, displayPath, input.view_range ?? undefined) }
        }
        case "create": {
            if (!input.path || input.file_text === undefined) {
                throw new Error("create requires path and file_text")
            }
            const relativePath = resolveMemoryPath(input.path)
            const displayPath = memoryDisplayPath(relativePath)
            if (await store.exists(volumeName, relativePath)) {
                return { success: true, message: `Error: File ${displayPath} already exists` }
            }
            await store.write(volumeName, relativePath, input.file_text)
            return { success: true, message: `File created successfully at: ${displayPath}` }
        }
        case "str_replace": {
            if (!input.path || input.old_str === undefined || input.new_str === undefined) {
                throw new Error("str_replace requires path, old_str, and new_str")
            }
            const relativePath = resolveMemoryPath(input.path)
            const displayPath = memoryDisplayPath(relativePath)
            if (!(await store.exists(volumeName, relativePath))) {
                return { success: true, message: `Error: The path ${displayPath} does not exist. Please provide a valid path.` }
            }
            const stat = await store.stat(volumeName, relativePath)
            if (stat.isDirectory) {
                return { success: true, message: `Error: The path ${displayPath} does not exist. Please provide a valid path.` }
            }

            const content = await store.read(volumeName, relativePath)
            const occurrences: number[] = []
            let index = content.indexOf(input.old_str)
            while (index !== -1) {
                const lineNumber = content.slice(0, index).split("\n").length
                occurrences.push(lineNumber)
                index = content.indexOf(input.old_str, index + input.old_str.length)
            }

            if (occurrences.length === 0) {
                return { success: true, message: `No replacement was performed, old_str \`${input.old_str}\` did not appear verbatim in ${displayPath}.` }
            }
            if (occurrences.length > 1) {
                return {
                    success: true,
                    message: `No replacement was performed. Multiple occurrences of old_str \`${input.old_str}\` in lines: ${occurrences.join(", ")}. Please ensure it is unique`
                }
            }

            const updated = content.replace(input.old_str, input.new_str)
            await store.write(volumeName, relativePath, updated)
            const editedLine = content.slice(0, content.indexOf(input.old_str)).split("\n").length
            return {
                success: true,
                message: `The memory file has been edited.\n${snippetWithLineNumbers(updated, editedLine)}`
            }
        }
        case "insert": {
            if (!input.path || input.insert_line === undefined || input.insert_text === undefined) {
                throw new Error("insert requires path, insert_line, and insert_text")
            }
            const relativePath = resolveMemoryPath(input.path)
            const displayPath = memoryDisplayPath(relativePath)
            if (!(await store.exists(volumeName, relativePath))) {
                return { success: true, message: `Error: The path ${displayPath} does not exist` }
            }
            const stat = await store.stat(volumeName, relativePath)
            if (stat.isDirectory) {
                return { success: true, message: `Error: The path ${displayPath} does not exist` }
            }

            const content = await store.read(volumeName, relativePath)
            const lines = content.split("\n")
            const maxLine = lines.length
            if (input.insert_line < 0 || input.insert_line > maxLine) {
                return {
                    success: true,
                    message: `Error: Invalid \`insert_line\` parameter: ${input.insert_line}. It should be within the range of lines of the file: [0, ${maxLine}]`
                }
            }

            const insertLines = input.insert_text.split("\n")
            lines.splice(input.insert_line, 0, ...insertLines)
            await store.write(volumeName, relativePath, lines.join("\n"))
            return { success: true, message: `The file ${displayPath} has been edited.` }
        }
        case "delete": {
            if (!input.path) {
                throw new Error("delete requires path")
            }
            const relativePath = resolveMemoryPath(input.path)
            const displayPath = memoryDisplayPath(relativePath)
            if (!(await store.exists(volumeName, relativePath))) {
                return { success: true, message: `Error: The path ${displayPath} does not exist` }
            }
            await store.deletePath(volumeName, relativePath)
            return { success: true, message: `Successfully deleted ${displayPath}` }
        }
        case "rename": {
            if (!input.old_path || !input.new_path) {
                throw new Error("rename requires old_path and new_path")
            }
            const fromPath = resolveMemoryPath(input.old_path)
            const toPath = resolveMemoryPath(input.new_path)
            const fromDisplay = memoryDisplayPath(fromPath)
            const toDisplay = memoryDisplayPath(toPath)
            if (!(await store.exists(volumeName, fromPath))) {
                return { success: true, message: `Error: The path ${fromDisplay} does not exist` }
            }
            if (await store.exists(volumeName, toPath)) {
                return { success: true, message: `Error: The destination ${toDisplay} already exists` }
            }
            await store.rename(volumeName, fromPath, toPath)
            return { success: true, message: `Successfully renamed ${fromDisplay} to ${toDisplay}` }
        }
        default: {
            const exhaustive: never = input.command
            throw new Error(`Unsupported memory command: ${exhaustive}`)
        }
    }
}
