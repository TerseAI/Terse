// From backend/: pnpm exec node --env-file=.env --import tsx scripts/smoke-durable-folder.mts
// Creates temporary Modal sandboxes and run volumes, then deletes them.
import { ModalClient } from "modal"
import type { Sandbox, Volume } from "modal"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

import { ModalRunStorage } from "../src/services/sandboxProvider/runStorage.ts"

// Use the compiler already installed with tsx to run the actual CLI helper in Modal.
const require = createRequire(import.meta.url)
const tsxRequire = createRequire(require.resolve("tsx/cli"))
const { build } = await import(pathToFileURL(tsxRequire.resolve("esbuild")).href)
const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../../packages/terse-cli/src/providers/typescript/runtimes/durableFolder.ts", import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    write: false
})
const modal = new ModalClient({ tokenId: process.env.MODAL_TOKEN_ID, tokenSecret: process.env.MODAL_TOKEN_SECRET })
const storage = new ModalRunStorage(modal)
const projectId = `durable-folder-smoke-${randomUUID()}`
const sandboxes = new Set<Sandbox>()

async function command(sandbox: Sandbox, code: string, env: Record<string, string> = {}): Promise<string> {
    const process = await sandbox.exec(["node", "--input-type=module", "-e", code], { env, timeoutMs: 60_000 })
    const [exit, stdout, stderr] = await Promise.all([process.wait(), process.stdout.readText(), process.stderr.readText()])
    assert.equal(exit, 0, stderr)
    return stdout.trim()
}

try {
    const app = await modal.apps.fromName("terse-durable-folder-smoke", { createIfMissing: true })
    const image = modal.images.fromRegistry("node:22-slim")
    async function create(runId: string): Promise<Sandbox> {
        const prepared = await storage.prepare(projectId, runId)
        const sandbox = await modal.sandboxes.create(app, image, {
            volumes: prepared.volumes as Record<string, Volume>,
            timeoutMs: 180_000,
            idleTimeoutMs: 60_000
        })
        sandboxes.add(sandbox)
        return sandbox
    }
    const writer = await create("run-a")
    await writer.filesystem.writeText(bundle.outputFiles[0].text, "/tmp/durable-folder.mjs")
    console.log(
        await command(
            writer,
            `
        import assert from 'node:assert/strict';
        import { withDurableFolder, syncModalFolder } from '/tmp/durable-folder.mjs';
        import { mkdir, writeFile } from 'node:fs/promises';
        await mkdir('/tmp/not-a-volume');
        process.env.TERSE_DURABLE_DIR = '/tmp/not-a-volume';
        await assert.rejects(withDurableFolder('run-a', async () => assert.fail('must not execute')), /not a mounted volume/);
        process.env.TERSE_DURABLE_DIR = '/terse/durable';
        await assert.rejects(syncModalFolder('/terse/nonexistent'), /Unable to save durable folder/);
        await withDurableFolder('run-a', async folder => {
            await writeFile(folder.path + '/draft.txt', 'saved before sandbox replacement');
            await folder.sync();
        });
        console.log('PASS: rejects missing mounts and failed sync; saves a real v2 volume');
    `,
            { IS_SANDBOX: "1", TERSE_DURABLE_DIR: "/terse/durable", TERSE_DURABLE_SYNC: "modal" }
        )
    )

    const readDraft = `import { readFile } from 'node:fs/promises'; console.log(await readFile('/terse/durable/draft.txt', 'utf8'))`
    const reader = await create("run-a")
    assert.equal(await command(reader, readDraft), "saved before sandbox replacement")
    console.log("PASS: a fresh sandbox reads committed data while the writer is alive")

    await writer.terminate()
    sandboxes.delete(writer)
    const replacement = await create("run-a")
    assert.equal(await command(replacement, readDraft), "saved before sandbox replacement")
    console.log("PASS: a replacement sandbox reads committed data after writer termination")

    const isolated = await create("run-b")
    assert.equal(await command(isolated, `import { readdir } from 'node:fs/promises'; console.log(JSON.stringify(await readdir('/terse/durable')))`), "[]")
    console.log("PASS: another run has an empty, isolated folder")
} finally {
    const results = await Promise.allSettled([...sandboxes].map(sandbox => sandbox.terminate()))
    await storage.deleteProject(projectId)
    for (const result of results) if (result.status === "rejected") throw result.reason
    console.log("Removed smoke-test sandboxes and durable volumes")
}
