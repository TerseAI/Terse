import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test as baseTest } from "vitest"

type FilesystemFixtures = {
    journalDirectory: string
}

export const test = baseTest.extend<FilesystemFixtures>({
    journalDirectory: async ({}, use) => {
        const directory = await mkdtemp(join(tmpdir(), "terse-durable-test-"))

        try {
            await use(directory)
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    }
})
