import { MemoryCommand, MemoryCreateCommand, MemoryDeleteCommand, MemoryInsertCommand, MemoryRenameCommand, MemoryStrReplaceCommand, MemoryViewCommand } from "terse-types"

import logger from "../../../common/logger"
import { db } from "../../../loaders/prisma"
import { MEMORY_ROOT, resolveMemoryVolumePath } from "../../../services/memory/memoryPaths"
import { testMemorySubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { VolumeFs, getVolumeManager } from "../../../services/volumes"
import { defineSessionTool } from "../../../tools/toolUtils"

export const memoryTool = defineSessionTool({
    name: "memory",
    description:
        "Persistent memory stored under /memories that survives across runs. Commands: view (read a file or list a directory), create, str_replace, insert, delete, rename. Always view /memories before starting a task, and record durable progress and learnings as you work.",
    execute: async (input, context) => {
        const runId = context?.context?.runId
        if (!runId) {
            throw new Error("memory tool requires an active run context")
        }

        const { projectId, subtreeKey, isTest } = await resolveMemoryScope(runId)
        const command = input.command
        logger.info("SDK memory tool: command", { runId, projectId, subtreeKey, isTest, op: command.op, path: "path" in command ? (command.path ?? undefined) : undefined })
        const fs = await getVolumeManager().openProjectVolumeFs(projectId, runId)
        try {
            const result = await runMemoryCommand(fs, subtreeKey, command)
            return { success: true, result }
        } finally {
            await fs.dispose().catch(err => logger.warn("memory tool: volume fs dispose failed", { runId, error: err }))
        }
    }
})

async function resolveMemoryScope(runId: string): Promise<{ projectId: string; subtreeKey: string; isTest: boolean }> {
    const run = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { automation_id: true, is_test: true, automation: { select: { project_id: true } } }
    })
    if (!run) {
        throw new Error("memory tool: no project linked for this run. Memory requires a project (link one with `terse init` or run a deployed job).")
    }
    // Test runs write to a sibling subtree so they can never read or clobber the deployed agent's memory.
    const subtreeKey = run.is_test ? testMemorySubtreeKey(run.automation_id) : run.automation_id
    return { projectId: run.automation.project_id, subtreeKey, isTest: run.is_test }
}

async function runMemoryCommand(fs: VolumeFs, subtreeKey: string, command: MemoryCommand): Promise<string> {
    switch (command.op) {
        case "view":
            return viewCommand(fs, subtreeKey, command)
        case "create":
            return createCommand(fs, subtreeKey, command)
        case "str_replace":
            return strReplaceCommand(fs, subtreeKey, command)
        case "insert":
            return insertCommand(fs, subtreeKey, command)
        case "delete":
            return deleteCommand(fs, subtreeKey, command)
        case "rename":
            return renameCommand(fs, subtreeKey, command)
        default:
            throw new Error(`Error: Unknown command ${String((command as { op?: unknown }).op)}`)
    }
}

async function viewCommand(fs: VolumeFs, subtreeKey: string, input: MemoryViewCommand): Promise<string> {
    const modelPath = input.path ?? MEMORY_ROOT
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: modelPath, source: "model" })
    if (rel === null) throw new Error(invalidPath(modelPath))

    const stat = await fs.stat(rel)
    if (!stat) {
        if (rel === subtreeKey) return renderDirListing(modelPath, 0, [])
        throw new Error(`The path ${modelPath} does not exist. Please provide a valid path.`)
    }

    if (stat.isDirectory) {
        const lines = await listDirTwoLevels(fs, subtreeKey, rel, modelPath)
        return renderDirListing(modelPath, stat.sizeBytes, lines)
    }

    const content = (await fs.read(rel)) ?? ""
    return renderFileWithLineNumbers(modelPath, content, input.view_range ?? null)
}

function renderDirListing(modelPath: string, sizeBytes: number, lines: string[]): string {
    return [`Here're the files and directories up to 2 levels deep in ${modelPath}, excluding hidden items and node_modules:`, `${humanSize(sizeBytes)}\t${modelPath}`, ...lines].join("\n")
}

async function listDirTwoLevels(fs: VolumeFs, subtreeKey: string, rel: string, modelPath: string): Promise<string[]> {
    const out: string[] = []
    const top = (await fs.list(rel)).filter(e => !e.name.startsWith(".") && e.name !== "node_modules").sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of top) {
        const childModelPath = joinModelPath(modelPath, entry.name)
        out.push(`${humanSize(entry.sizeBytes)}\t${childModelPath}`)
        if (entry.isDirectory) {
            const childRel = resolveMemoryVolumePath({ subtreeKey, inputPath: childModelPath, source: "model" })
            if (childRel === null) continue
            const children = (await fs.list(childRel)).filter(e => !e.name.startsWith(".") && e.name !== "node_modules").sort((a, b) => a.name.localeCompare(b.name))
            for (const child of children) {
                out.push(`${humanSize(child.sizeBytes)}\t${joinModelPath(childModelPath, child.name)}`)
            }
        }
    }
    return out
}

async function createCommand(fs: VolumeFs, subtreeKey: string, input: MemoryCreateCommand): Promise<string> {
    const modelPath = input.path
    if (!modelPath) throw new Error("Error: create requires a path")
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: modelPath, source: "model" })
    if (rel === null) throw new Error(invalidPath(modelPath))

    const existing = await fs.stat(rel)
    if (existing) throw new Error(`Error: File ${modelPath} already exists`)

    await fs.write(rel, input.file_text ?? "")
    await fs.sync()
    return `File created successfully at: ${modelPath}`
}

async function strReplaceCommand(fs: VolumeFs, subtreeKey: string, input: MemoryStrReplaceCommand): Promise<string> {
    const modelPath = input.path
    if (!modelPath) throw new Error("Error: str_replace requires a path")
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: modelPath, source: "model" })
    if (rel === null) throw new Error(invalidPath(modelPath))

    const content = await fs.read(rel)
    if (content === null) throw new Error(`Error: The path ${modelPath} does not exist. Please provide a valid path.`)

    const oldStr = input.old_str ?? ""
    const occurrences = countOccurrences(content, oldStr)
    if (occurrences === 0) {
        throw new Error(`No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${modelPath}.`)
    }
    if (occurrences > 1) {
        const lineNumbers = matchingLineNumbers(content, oldStr)
        throw new Error(`No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${lineNumbers.join(", ")}. Please ensure it is unique`)
    }

    await fs.write(rel, content.replace(oldStr, input.new_str ?? ""))
    await fs.sync()
    return "The memory file has been edited."
}

async function insertCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInsertCommand): Promise<string> {
    const modelPath = input.path
    if (!modelPath) throw new Error("Error: insert requires a path")
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: modelPath, source: "model" })
    if (rel === null) throw new Error(invalidPath(modelPath))

    const content = await fs.read(rel)
    if (content === null) throw new Error(`Error: The path ${modelPath} does not exist`)

    const lines = content.split("\n")
    const insertLine = input.insert_line ?? 0
    if (insertLine < 0 || insertLine > lines.length) {
        throw new Error(`Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`)
    }

    const insertText = input.insert_text ?? ""
    lines.splice(insertLine, 0, insertText.replace(/\n$/, ""))
    await fs.write(rel, lines.join("\n"))
    await fs.sync()
    return `The file ${modelPath} has been edited.`
}

async function deleteCommand(fs: VolumeFs, subtreeKey: string, input: MemoryDeleteCommand): Promise<string> {
    const modelPath = input.path
    if (!modelPath) throw new Error("Error: delete requires a path")
    const rel = resolveMemoryVolumePath({ subtreeKey, inputPath: modelPath, source: "model" })
    if (rel === null) throw new Error(invalidPath(modelPath))

    const stat = await fs.stat(rel)
    if (!stat) throw new Error(`Error: The path ${modelPath} does not exist`)

    await fs.remove(rel)
    await fs.sync()
    return `Successfully deleted ${modelPath}`
}

async function renameCommand(fs: VolumeFs, subtreeKey: string, input: MemoryRenameCommand): Promise<string> {
    const oldModelPath = input.old_path
    const newModelPath = input.new_path
    if (!oldModelPath || !newModelPath) throw new Error("Error: rename requires old_path and new_path")
    const oldRel = resolveMemoryVolumePath({ subtreeKey, inputPath: oldModelPath, source: "model" })
    const newRel = resolveMemoryVolumePath({ subtreeKey, inputPath: newModelPath, source: "model" })
    if (oldRel === null) throw new Error(invalidPath(oldModelPath))
    if (newRel === null) throw new Error(invalidPath(newModelPath))

    if (!(await fs.stat(oldRel))) throw new Error(`Error: The path ${oldModelPath} does not exist`)
    if (await fs.stat(newRel)) throw new Error(`Error: The destination ${newModelPath} already exists`)

    await fs.rename(oldRel, newRel)
    await fs.sync()
    return `Successfully renamed ${oldModelPath} to ${newModelPath}`
}

function invalidPath(modelPath: string): string {
    return `Error: The path ${modelPath} is invalid. Paths must be within ${MEMORY_ROOT}.`
}

function joinModelPath(base: string, name: string): string {
    return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`
}

function renderFileWithLineNumbers(modelPath: string, content: string, viewRange: number[] | null): string {
    const allLines = content.split("\n")
    let start = 1
    let end = allLines.length
    if (viewRange && viewRange.length === 2) {
        start = Math.max(1, viewRange[0])
        end = viewRange[1] === -1 ? allLines.length : Math.min(allLines.length, viewRange[1])
    }
    const body = allLines
        .slice(start - 1, end)
        .map((line, idx) => `${String(start + idx).padStart(6, " ")}\t${line}`)
        .join("\n")
    return `Here's the content of ${modelPath} with line numbers:\n${body}`
}

function countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0
    let count = 0
    let idx = haystack.indexOf(needle)
    while (idx !== -1) {
        count++
        idx = haystack.indexOf(needle, idx + needle.length)
    }
    return count
}

function matchingLineNumbers(content: string, needle: string): number[] {
    const lines = content.split("\n")
    const result: number[] = []
    lines.forEach((line, idx) => {
        if (needle && line.includes(needle)) result.push(idx + 1)
    })
    return result
}

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    const units = ["K", "M", "G", "T"]
    let value = bytes / 1024
    let unitIdx = 0
    while (value >= 1024 && unitIdx < units.length - 1) {
        value /= 1024
        unitIdx++
    }
    return `${value.toFixed(1)}${units[unitIdx]}`
}
