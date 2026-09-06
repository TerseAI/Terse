import { JournalEventSchema } from "little-durable"
import type { JournalStore } from "little-durable"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, stat } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type DurableFolder = { path: string; sync: () => Promise<void> }

/** Set the path only for this invocation; a second local run must get its own folder. */
export async function withDurableFolder<T>(runId: string, run: (folder: DurableFolder) => Promise<T>): Promise<T> {
    const previousPath = process.env.TERSE_DURABLE_DIR
    const mode = process.env.TERSE_DURABLE_SYNC
    if (mode && mode !== "modal" && mode !== "local") throw new Error(`Unknown durable folder sync mode: ${mode}`)
    if (process.env.IS_SANDBOX === "1" && (!previousPath || !mode)) {
        throw new Error("The sandbox has no durable folder configured. Update the Terse backend and retry the run.")
    }
    if (previousPath && !isAbsolute(previousPath)) throw new Error("TERSE_DURABLE_DIR must be an absolute path.")
    const path = previousPath || resolve(".terse", "runs", createHash("sha256").update(runId).digest("hex"), "durable")
    if (mode === "modal") {
        // Never turn a missing volume into an ordinary, disposable directory. This
        // also rejects a sandbox reused from before durable mounts were enabled.
        // Modal exposes volumes through symlinks. stat follows them; mountinfo
        // does not list the user-facing path as a mountpoint.
        const [folder, root] = await Promise.all([stat(path), stat("/")])
        if (!folder.isDirectory() || folder.dev === root.dev) {
            throw new Error(`Durable folder ${path} is not a mounted volume. Recreate the sandbox before retrying.`)
        }
    } else {
        await mkdir(path, { recursive: true })
    }
    process.env.TERSE_DURABLE_DIR = path
    try {
        return await run({ path, sync: mode === "modal" ? () => syncModalFolder(path) : async () => {} })
    } finally {
        if (previousPath === undefined) delete process.env.TERSE_DURABLE_DIR
        else process.env.TERSE_DURABLE_DIR = previousPath
    }
}

export async function syncModalFolder(path: string): Promise<void> {
    try {
        await execFileAsync("sync", [path], { timeout: 60_000, killSignal: "SIGKILL" })
    } catch (cause) {
        throw new Error(`Unable to save durable folder ${path}. Progress was not recorded. ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    }
}

/** Sync before acknowledging progress, including the last writes before a wait or exit. */
export function withDurableFolderSync(store: JournalStore, sync: () => Promise<void>): JournalStore {
    let syncFailure: unknown
    return {
        list: params => store.list(params),
        listByType: params => store.listByType(params),
        get: params => store.get(params),
        popStep: params => store.popStep(params),
        async append(params) {
            const event = JournalEventSchema.parse(params.event)
            if (event.type === "step.completed" || event.type === "wait.requested" || event.type === "run.completed") {
                // A workflow catching a sync error must not subsequently report success.
                if (syncFailure) throw syncFailure
                try {
                    await sync()
                } catch (error) {
                    syncFailure = error instanceof Error ? error : new Error(String(error))
                    throw syncFailure
                }
            }
            return store.append(params)
        }
    }
}
