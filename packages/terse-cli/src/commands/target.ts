import { confirm, isCancel } from "@clack/prompts"
import chalk from "chalk"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { PRODUCTION_BACKEND_URL, PRODUCTION_FRONTEND_URL } from "../config.js"

const BLOCK_BEGIN = "# >>> terse target (managed by `terse target`) >>>"
const BLOCK_END = "# <<< terse target <<<"

const LOCAL_BACKEND_URL = "http://localhost:3001"
const LOCAL_FRONTEND_URL = "http://localhost:5173"

export function targetStatus(): void {
    const backendEnv = process.env.TERSE_BACKEND_URL
    const frontendEnv = process.env.TERSE_FRONTEND_URL
    const backendUrl = backendEnv ?? PRODUCTION_BACKEND_URL
    const frontendUrl = frontendEnv ?? PRODUCTION_FRONTEND_URL

    const label = describeTarget({ backendUrl, frontendUrl })
    console.log(`Target: ${chalk.bold(label)}`)
    console.log(`  Backend:  ${backendUrl} ${backendEnv ? chalk.dim("(TERSE_BACKEND_URL)") : chalk.dim("(default)")}`)
    console.log(`  Frontend: ${frontendUrl} ${frontendEnv ? chalk.dim("(TERSE_FRONTEND_URL)") : chalk.dim("(default)")}`)

    const rc = detectShellRcPath()
    if (rc) {
        const existing = readManagedBlock(rc)
        if (existing) {
            console.log(chalk.dim(`\nShell rc: ${rc} has a terse target block.`))
        } else {
            console.log(chalk.dim(`\nShell rc: ${rc} has no terse target block.`))
        }
    }
}

export async function targetUse(preset: string | undefined, opts: TargetUseOpts): Promise<void> {
    const urls = resolveUrlsForUse(preset, opts)

    const rcPath = detectShellRcPath()
    if (!rcPath) {
        console.log(chalk.yellow("Could not detect a shell rc file (~/.zshrc or ~/.bashrc)."))
        console.log("Add these lines to your shell config manually:\n")
        console.log(formatExportBlock(urls))
        return
    }

    const block = formatExportBlock(urls)

    console.log(`About to update ${chalk.bold(rcPath)} with:\n`)
    console.log(block)
    console.log("")

    if (!opts.yes) {
        const answer = await confirm({ message: "Append/replace this block in your shell rc?", initialValue: true })
        if (isCancel(answer) || !answer) {
            console.log(chalk.dim("Aborted. Nothing written."))
            return
        }
    }

    writeManagedBlock(rcPath, block)
    console.log(chalk.green(`Wrote terse target block to ${rcPath}.`))
    console.log(chalk.dim(`Run \`source ${rcPath}\` or open a new shell to pick up the new URLs.`))
}

export async function targetClear(opts: { yes?: boolean }): Promise<void> {
    const rcPath = detectShellRcPath()
    if (!rcPath) {
        console.log(chalk.yellow("Could not detect a shell rc file (~/.zshrc or ~/.bashrc). Nothing to clear."))
        return
    }
    const existing = readManagedBlock(rcPath)
    if (!existing) {
        console.log(chalk.dim(`No terse target block found in ${rcPath}.`))
        return
    }

    console.log(`About to remove the terse target block from ${chalk.bold(rcPath)}.`)
    if (!opts.yes) {
        const answer = await confirm({ message: "Remove the block?", initialValue: true })
        if (isCancel(answer) || !answer) {
            console.log(chalk.dim("Aborted. Nothing written."))
            return
        }
    }
    removeManagedBlock(rcPath)
    console.log(chalk.green(`Removed terse target block from ${rcPath}.`))
    console.log(chalk.dim(`Run \`unset TERSE_BACKEND_URL TERSE_FRONTEND_URL\` in this shell, or open a new shell.`))
}

function resolveUrlsForUse(preset: string | undefined, opts: TargetUseOpts): Urls {
    if (preset === "production" || preset === "prod") {
        return { backendUrl: PRODUCTION_BACKEND_URL, frontendUrl: PRODUCTION_FRONTEND_URL }
    }
    if (preset === "local") {
        return {
            backendUrl: opts.backendUrl ?? LOCAL_BACKEND_URL,
            frontendUrl: opts.frontendUrl ?? LOCAL_FRONTEND_URL
        }
    }
    if (preset && !opts.backendUrl) {
        return {
            backendUrl: preset,
            frontendUrl: opts.frontendUrl ?? PRODUCTION_FRONTEND_URL
        }
    }
    if (!opts.backendUrl || !opts.frontendUrl) {
        throw new Error("Provide a preset (`local` / `production`) or both --backend-url and --frontend-url.")
    }
    return { backendUrl: opts.backendUrl, frontendUrl: opts.frontendUrl }
}

function describeTarget(urls: Urls): string {
    if (urls.backendUrl === PRODUCTION_BACKEND_URL && urls.frontendUrl === PRODUCTION_FRONTEND_URL) return "cloud (production)"
    if (urls.backendUrl.includes("localhost") || urls.backendUrl.includes("127.0.0.1")) return "local"
    return "custom"
}

function formatExportBlock(urls: Urls): string {
    return [BLOCK_BEGIN, `export TERSE_BACKEND_URL="${urls.backendUrl}"`, `export TERSE_FRONTEND_URL="${urls.frontendUrl}"`, BLOCK_END].join("\n")
}

function detectShellRcPath(): string | null {
    const shell = process.env.SHELL ?? ""
    const home = os.homedir()
    if (shell.includes("zsh")) return path.join(home, ".zshrc")
    if (shell.includes("bash")) {
        const bashrc = path.join(home, ".bashrc")
        if (fs.existsSync(bashrc)) return bashrc
        const bashProfile = path.join(home, ".bash_profile")
        if (fs.existsSync(bashProfile)) return bashProfile
        return bashrc
    }
    const candidates = [path.join(home, ".zshrc"), path.join(home, ".bashrc"), path.join(home, ".bash_profile")]
    return candidates.find(p => fs.existsSync(p)) ?? null
}

function readManagedBlock(rcPath: string): string | null {
    if (!fs.existsSync(rcPath)) return null
    const contents = fs.readFileSync(rcPath, "utf-8")
    const startIdx = contents.indexOf(BLOCK_BEGIN)
    if (startIdx === -1) return null
    const endIdx = contents.indexOf(BLOCK_END, startIdx)
    if (endIdx === -1) return null
    return contents.slice(startIdx, endIdx + BLOCK_END.length)
}

function writeManagedBlock(rcPath: string, block: string): void {
    const exists = fs.existsSync(rcPath)
    const original = exists ? fs.readFileSync(rcPath, "utf-8") : ""
    const stripped = stripManagedBlock(original)
    const needsLeadingNewline = stripped.length > 0 && !stripped.endsWith("\n")
    const next = stripped + (needsLeadingNewline ? "\n" : "") + (stripped.length > 0 ? "\n" : "") + block + "\n"
    fs.writeFileSync(rcPath, next)
}

function removeManagedBlock(rcPath: string): void {
    const original = fs.readFileSync(rcPath, "utf-8")
    fs.writeFileSync(rcPath, stripManagedBlock(original))
}

function stripManagedBlock(contents: string): string {
    const startIdx = contents.indexOf(BLOCK_BEGIN)
    if (startIdx === -1) return contents
    const endIdx = contents.indexOf(BLOCK_END, startIdx)
    if (endIdx === -1) return contents
    const after = endIdx + BLOCK_END.length
    let trimEnd = after
    if (contents[trimEnd] === "\n") trimEnd += 1
    let trimStart = startIdx
    if (trimStart > 0 && contents[trimStart - 1] === "\n") trimStart -= 1
    return contents.slice(0, trimStart) + contents.slice(trimEnd)
}

type Urls = {
    backendUrl: string
    frontendUrl: string
}

export type TargetUseOpts = {
    backendUrl?: string
    frontendUrl?: string
    yes?: boolean
}
