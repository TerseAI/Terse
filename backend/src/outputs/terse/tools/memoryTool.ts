import path from "node:path"

import logger from "../../../common/logger"
import { db } from "../../../loaders/prisma"
import { getSandboxProvider } from "../../../services/sandboxProvider"
import { VolumeFs } from "../../../services/sandboxProvider/SandboxService"
import { testMemorySubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { defineSessionTool } from "../../../tools/toolUtils"

const MEMORY_ROOT = "/memories"

type MemoryInput = {
    command: "view" | "create" | "str_replace" | "insert" | "delete" | "rename"
    path: string | null
    view_range: number[] | null
    file_text: string | null
    old_str: string | null
    new_str: string | null
    insert_line: number | null
    insert_text: string | null
    old_path: string | null
    new_path: string | null
}

export const memoryTool = defineSessionTool({
    name: "memory",
    description:
        "Persistent memory stored under /memories that survives across runs. Commands: view (read a file or list a directory), create, str_replace, insert, delete, rename. Always view /memories before starting a task, and record durable progress and learnings as you work.",
    execute: async (input, context) => {
        const runId = context?.context?.runId
        if (!runId) {
            throw new Error("memory tool requires an active run context")
        }

        const testScope = context?.context?.testMemoryScope
        const isTest = !!testScope
        const { projectId, subtreeKey } = testScope ? { projectId: testScope.projectId, subtreeKey: testMemorySubtreeKey(testScope.jobName) } : await resolveMemoryScope(runId)
        const command = (input as MemoryInput).command
        logger.info("SDK memory tool: command", { runId, projectId, subtreeKey, isTest, command, path: (input as MemoryInput).path ?? undefined })
        const provider = getSandboxProvider()
        const fs = isTest ? await provider.getTestProjectVolumeFs(projectId) : await provider.getProjectVolumeFs(projectId, runId)
        try {
            const result = await runMemoryCommand(fs, subtreeKey, input as MemoryInput)
            return { success: true, result }
        } finally {
            await fs.dispose().catch(err => logger.warn("memory tool: volume fs dispose failed", { runId, error: err }))
        }
    }
})

async function resolveMemoryScope(runId: string): Promise<{ projectId: string; subtreeKey: string }> {
    const run = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { automation_id: true, automation: { select: { project_id: true } } }
    })
    if (!run) {
        throw new Error(`memory tool: run ${runId} not found`)
    }
    return { projectId: run.automation.project_id, subtreeKey: run.automation_id }
}

async function runMemoryCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    switch (input.command) {
        case "view":
            return viewCommand(fs, subtreeKey, input)
        case "create":
            return createCommand(fs, subtreeKey, input)
        case "str_replace":
            return strReplaceCommand(fs, subtreeKey, input)
        case "insert":
            return insertCommand(fs, subtreeKey, input)
        case "delete":
            return deleteCommand(fs, subtreeKey, input)
        case "rename":
            return renameCommand(fs, subtreeKey, input)
        default:
            return `Error: Unknown command ${String((input as { command?: unknown }).command)}`
    }
}

async function viewCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const modelPath = input.path ?? MEMORY_ROOT
    const rel = safeRel(subtreeKey, modelPath)
    if (rel === null) return invalidPath(modelPath)

    const stat = await fs.stat(rel)
    if (!stat) {
        if (rel === subtreeKey) return renderDirListing(modelPath, 0, [])
        return `The path ${modelPath} does not exist. Please provide a valid path.`
    }

    if (stat.isDirectory) {
        const lines = await listDirTwoLevels(fs, subtreeKey, rel, modelPath)
        return renderDirListing(modelPath, stat.sizeBytes, lines)
    }

    const content = (await fs.read(rel)) ?? ""
    return renderFileWithLineNumbers(modelPath, content, input.view_range)
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
            const childRel = safeRel(subtreeKey, childModelPath)
            if (childRel === null) continue
            const children = (await fs.list(childRel)).filter(e => !e.name.startsWith(".") && e.name !== "node_modules").sort((a, b) => a.name.localeCompare(b.name))
            for (const child of children) {
                out.push(`${humanSize(child.sizeBytes)}\t${joinModelPath(childModelPath, child.name)}`)
            }
        }
    }
    return out
}

async function createCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const modelPath = input.path
    if (!modelPath) return "Error: create requires a path"
    const rel = safeRel(subtreeKey, modelPath)
    if (rel === null) return invalidPath(modelPath)

    const existing = await fs.stat(rel)
    if (existing) return `Error: File ${modelPath} already exists`

    await fs.write(rel, input.file_text ?? "")
    await fs.sync()
    return `File created successfully at: ${modelPath}`
}

async function strReplaceCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const modelPath = input.path
    if (!modelPath) return "Error: str_replace requires a path"
    const rel = safeRel(subtreeKey, modelPath)
    if (rel === null) return invalidPath(modelPath)

    const content = await fs.read(rel)
    if (content === null) return `Error: The path ${modelPath} does not exist. Please provide a valid path.`

    const oldStr = input.old_str ?? ""
    const occurrences = countOccurrences(content, oldStr)
    if (occurrences === 0) {
        return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${modelPath}.`
    }
    if (occurrences > 1) {
        const lineNumbers = matchingLineNumbers(content, oldStr)
        return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${lineNumbers.join(", ")}. Please ensure it is unique`
    }

    await fs.write(rel, content.replace(oldStr, input.new_str ?? ""))
    await fs.sync()
    return "The memory file has been edited."
}

async function insertCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const modelPath = input.path
    if (!modelPath) return "Error: insert requires a path"
    const rel = safeRel(subtreeKey, modelPath)
    if (rel === null) return invalidPath(modelPath)

    const content = await fs.read(rel)
    if (content === null) return `Error: The path ${modelPath} does not exist`

    const lines = content.split("\n")
    const insertLine = input.insert_line ?? 0
    if (insertLine < 0 || insertLine > lines.length) {
        return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`
    }

    const insertText = input.insert_text ?? ""
    lines.splice(insertLine, 0, insertText.replace(/\n$/, ""))
    await fs.write(rel, lines.join("\n"))
    await fs.sync()
    return `The file ${modelPath} has been edited.`
}

async function deleteCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const modelPath = input.path
    if (!modelPath) return "Error: delete requires a path"
    const rel = safeRel(subtreeKey, modelPath)
    if (rel === null) return invalidPath(modelPath)

    const stat = await fs.stat(rel)
    if (!stat) return `Error: The path ${modelPath} does not exist`

    await fs.remove(rel)
    await fs.sync()
    return `Successfully deleted ${modelPath}`
}

async function renameCommand(fs: VolumeFs, subtreeKey: string, input: MemoryInput): Promise<string> {
    const oldModelPath = input.old_path
    const newModelPath = input.new_path
    if (!oldModelPath || !newModelPath) return "Error: rename requires old_path and new_path"
    const oldRel = safeRel(subtreeKey, oldModelPath)
    const newRel = safeRel(subtreeKey, newModelPath)
    if (oldRel === null) return invalidPath(oldModelPath)
    if (newRel === null) return invalidPath(newModelPath)

    if (!(await fs.stat(oldRel))) return `Error: The path ${oldModelPath} does not exist`
    if (await fs.stat(newRel)) return `Error: The destination ${newModelPath} already exists`

    await fs.rename(oldRel, newRel)
    await fs.sync()
    return `Successfully renamed ${oldModelPath} to ${newModelPath}`
}

// Maps a model-facing /memories path to a volume-relative path under the automation's subtree, or null
// if it escapes /memories (path traversal). The automation subtree gives per-agent isolation.
function safeRel(subtreeKey: string, modelPath: string): string | null {
    if (!modelPath || modelPath.includes("\0")) return null
    const lowered = modelPath.toLowerCase()
    if (lowered.includes("%2e") || lowered.includes("%2f") || modelPath.includes("..")) return null

    let rest: string
    if (modelPath === MEMORY_ROOT || modelPath === `${MEMORY_ROOT}/`) {
        rest = ""
    } else if (modelPath.startsWith(`${MEMORY_ROOT}/`)) {
        rest = modelPath.slice(MEMORY_ROOT.length + 1)
    } else {
        return null
    }

    const normalized = path.posix.normalize(rest)
    if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) return null
    if (normalized === "" || normalized === ".") return subtreeKey
    return `${subtreeKey}/${normalized}`
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
