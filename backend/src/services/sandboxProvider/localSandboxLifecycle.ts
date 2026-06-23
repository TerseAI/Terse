import { ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

import logger from "../../common/logger"

/**
 * Process lifecycle bookkeeping for LocalSandboxService.
 *
 * Without this, child processes spawned by `LocalSandbox.exec` would orphan in
 * three scenarios:
 *   1. Backend hot-reload or Ctrl+C — no SIGINT/SIGTERM handler to walk live sandboxes
 *   2. Unhandled exception in the job path — `terminate()` never called
 *   3. Hard crash (SIGKILL, OOM) — no JS-level handler runs
 *
 * Strategy:
 *   - In-memory registry of live sandboxes + signal handlers terminate them on
 *     graceful shutdown. Covers (1) and (2).
 *   - PID file (`.terse-pids`) per sandbox written on every `exec`. On startup
 *     we sweep all sandbox dirs and SIGTERM any still-alive PIDs from a previous
 *     run. Covers (3).
 *
 * The sweep is best-effort: PIDs can theoretically be recycled between runs, but
 * for the typical "crashed seconds ago" case this is fine. Cross-reboot the OS
 * usually wipes `os.tmpdir()` anyway so the .pids files don't survive.
 */

export const PID_FILE_NAME = ".terse-pids"

interface TerminableSandbox {
    terminate(): Promise<void>
}

const liveSandboxes = new Set<TerminableSandbox>()
let shutdownHooksInstalled = false

export function registerSandbox(sandbox: TerminableSandbox): void {
    liveSandboxes.add(sandbox)
    installShutdownHooks()
}

export function unregisterSandbox(sandbox: TerminableSandbox): void {
    liveSandboxes.delete(sandbox)
}

export async function recordChildPid(workingDir: string, child: ChildProcess): Promise<void> {
    if (child.pid === undefined) return
    const pidFile = path.join(workingDir, PID_FILE_NAME)
    await fs.appendFile(pidFile, `${child.pid}\n`)
}

export async function clearPidFile(workingDir: string): Promise<void> {
    const pidFile = path.join(workingDir, PID_FILE_NAME)
    await fs.rm(pidFile, { force: true })
}

/**
 * SIGTERM any PIDs recorded for a single sandbox dir and remove the dir. Used to
 * tear down a project's runtime sandbox on redeploy so the next run rebuilds from
 * the freshly deployed image. Best-effort: missing dir / dead PIDs are ignored.
 */
export async function terminateSandboxDir(workingDir: string): Promise<void> {
    if (!existsSync(workingDir)) return

    const pidFile = path.join(workingDir, PID_FILE_NAME)
    const content = await fs.readFile(pidFile, "utf8").catch(() => "")
    const pids = content
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0)

    for (const pid of pids) {
        try {
            process.kill(pid, "SIGTERM")
        } catch {
            // Process already dead or PID recycled out of our reach — fine.
        }
    }

    await fs.rm(workingDir, { recursive: true, force: true }).catch(() => {})
}

/**
 * Walk all sandbox working directories and SIGTERM any PIDs recorded in their
 * `.terse-pids` file that are still alive. Call once at startup, before any new
 * sandboxes get created.
 */
export async function sweepOrphanedSandboxProcesses(sandboxesDir: string): Promise<void> {
    if (!existsSync(sandboxesDir)) return

    const entries = await fs.readdir(sandboxesDir, { withFileTypes: true })
    let killed = 0

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const pidFile = path.join(sandboxesDir, entry.name, PID_FILE_NAME)
        if (!existsSync(pidFile)) continue

        const content = await fs.readFile(pidFile, "utf8").catch(() => "")
        const pids = content
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter(n => Number.isFinite(n) && n > 0)

        for (const pid of pids) {
            try {
                process.kill(pid, "SIGTERM")
                killed++
            } catch {
                // Process already dead or PID recycled out of our reach — fine.
            }
        }

        await fs.rm(pidFile, { force: true }).catch(() => {})
    }

    if (killed > 0) {
        logger.info("#LocalSandbox swept orphan child processes from previous run", { killed })
    }
}

function installShutdownHooks(): void {
    if (shutdownHooksInstalled) return
    shutdownHooksInstalled = true

    const terminateAllAndExit = async (signal: string, exitCode: number) => {
        logger.info("#LocalSandbox shutdown signal received, terminating live sandboxes", { signal, count: liveSandboxes.size })
        const all = Array.from(liveSandboxes)
        await Promise.all(all.map(sb => sb.terminate().catch(() => {})))
        process.exit(exitCode)
    }

    process.once("SIGINT", () => void terminateAllAndExit("SIGINT", 130))
    process.once("SIGTERM", () => void terminateAllAndExit("SIGTERM", 143))
    process.once("beforeExit", () => {
        const all = Array.from(liveSandboxes)
        void Promise.all(all.map(sb => sb.terminate().catch(() => {})))
    })
}
