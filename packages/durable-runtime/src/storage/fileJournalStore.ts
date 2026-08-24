import { createHash } from "node:crypto"
import { mkdir, open, readFile } from "node:fs/promises"
import { join } from "node:path"

import { JournalEventSchema } from "../types/journalEvent.js"
import type { JournalEvent } from "../types/journalEvent.js"
import type { JournalSnapshot, JournalStore } from "../types/journalStore.js"

import { JournalRevisionConflictError } from "./errors.js"

export class FileJournalStore implements JournalStore {
    constructor(private readonly rootDirectory: string) {}

    async read(runId: string): Promise<JournalSnapshot> {
        const source = await readJournalFile(this.pathFor(runId))
        if (source === undefined || source.length === 0) return { revision: 0, records: [] }

        const lines = source.endsWith("\n") ? source.slice(0, -1).split("\n") : source.split("\n")
        const records = lines.filter(line => line.length > 0).map(line => JournalEventSchema.parse(JSON.parse(line) as unknown))
        return { revision: records.length, records }
    }

    async append(runId: string, expectedRevision: number, event: JournalEvent): Promise<number> {
        const snapshot = await this.read(runId)
        if (snapshot.revision !== expectedRevision) {
            throw new JournalRevisionConflictError({
                runId,
                expectedRevision,
                actualRevision: snapshot.revision
            })
        }

        const serialized = JSON.stringify(JournalEventSchema.parse(event))

        await mkdir(this.rootDirectory, { recursive: true })
        const journal = await open(this.pathFor(runId), "a")
        try {
            await journal.writeFile(`${serialized}\n`, "utf8")
            await journal.sync()
        } finally {
            await journal.close()
        }

        return snapshot.revision + 1
    }

    private pathFor(runId: string): string {
        const filename = `${createHash("sha256").update(runId).digest("hex")}.jsonl`
        return join(this.rootDirectory, filename)
    }
}

async function readJournalFile(path: string): Promise<string | undefined> {
    try {
        return await readFile(path, "utf8")
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return undefined
        throw error
    }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
    return value instanceof Error && "code" in value
}
