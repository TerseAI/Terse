import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { JournalEventSchema } from "../types/journalEvent.js"
import type { JournalEvent } from "../types/journalEvent.js"
import type { AppendJournalEventParams, JournalStore, ReadJournalParams } from "../types/journalStore.js"

export class FileJournalStore implements JournalStore {
    constructor(private readonly rootDirectory: string) {}

    async read({ runId }: ReadJournalParams): Promise<readonly JournalEvent[]> {
        const runDirectory = this.runDirectoryFor(runId)
        const filenames = await readJournalDirectory(runDirectory)

        return Promise.all(
            filenames.sort().map(async filename => {
                const source = await readFile(join(runDirectory, filename), "utf8")
                return JournalEventSchema.parse(JSON.parse(source) as unknown)
            })
        )
    }

    async append({ runId, event }: AppendJournalEventParams): Promise<void> {
        const validatedEvent = JournalEventSchema.parse(event)
        const runDirectory = this.runDirectoryFor(runId)
        const filenames = await readJournalDirectory(runDirectory)
        const sequence = filenames.length + 1
        const filename = `${sequence.toString().padStart(8, "0")}-${validatedEvent.type}.json`

        await mkdir(runDirectory, { recursive: true })
        await writeFile(join(runDirectory, filename), `${JSON.stringify(validatedEvent, null, 2)}\n`, {
            encoding: "utf8",
            flag: "wx"
        })
    }

    private runDirectoryFor(runId: string): string {
        return join(this.rootDirectory, runId)
    }
}

async function readJournalDirectory(path: string): Promise<string[]> {
    try {
        const entries = await readdir(path, { withFileTypes: true })
        return entries.filter(entry => entry.isFile() && entry.name.endsWith(".json")).map(entry => entry.name)
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return []
        throw error
    }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
    return value instanceof Error && "code" in value
}
