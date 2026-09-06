import { Volume } from "modal"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { DURABLE_FOLDER, LocalRunStorage, ModalRunStorage, runStorageVolumeName } from "../src/services/sandboxProvider/runStorage"

test("reattaches the same v2 volume on retry and isolates other runs and projects", async () => {
    const requests: unknown[] = []
    const storage = new ModalRunStorage({
        environmentName: () => "test",
        cpClient: {
            volumeGetOrCreate: async (request: unknown) => {
                requests.push(request)
                return { volumeId: "vo-test", metadata: { version: 2 } }
            }
        }
    } as unknown as ConstructorParameters<typeof ModalRunStorage>[0])
    const first = await storage.prepare("project-a", "run/one")
    const retry = await storage.prepare("project-a", "run/one")
    const otherRun = await storage.prepare("project-a", "run/two")
    await storage.prepare("project-b", "run/one")
    assert.equal(first.path, DURABLE_FOLDER)
    assert.equal(first.syncMode, "modal")
    const mount = (value: typeof first) => value.volumes![DURABLE_FOLDER] as Volume
    assert.equal(mount(first).name, mount(retry).name)
    assert.notEqual(mount(first).name, mount(otherRun).name)
    assert.equal(mount(first)._mountOptions.subPath, undefined)
    assert.ok(mount(first).name!.length <= 64)
    assert.deepEqual(requests[0], { deploymentName: runStorageVolumeName("project-a", "run/one"), environmentName: "test", objectCreationType: 1, version: 2 })
    assert.notEqual((requests[0] as { deploymentName: string }).deploymentName, (requests[3] as { deploymentName: string }).deploymentName)
})

test("refuses a v1 volume or a response without verified v2 metadata", async () => {
    for (const metadata of [{ version: 1 }, undefined]) {
        const storage = new ModalRunStorage({
            environmentName: () => "test",
            cpClient: { volumeGetOrCreate: async () => ({ volumeId: "vo-test", metadata }) }
        } as unknown as ConstructorParameters<typeof ModalRunStorage>[0])
        await assert.rejects(storage.prepare("project", "run"), /requires a Modal Volume v2/)
    }
})

test("project deletion paginates and deletes only that project's durable volumes", async () => {
    const deleted: unknown[] = []
    const firstName = runStorageVolumeName("project-a", "run-a")
    const secondName = runStorageVolumeName("project-a", "run-b")
    let pages = 0
    const storage = new ModalRunStorage({
        environmentName: () => "test",
        cpClient: {
            volumeList: async (request: { pagination: { createdBefore: number } }) => {
                if (++pages === 1) {
                    assert.equal(request.pagination.createdBefore, 0)
                    return { items: Array.from({ length: 100 }, (_, i) => ({ label: i === 0 ? firstName : runStorageVolumeName("project-b", `run-${i}`), createdAt: 1000 - i })) }
                }
                assert.equal(request.pagination.createdBefore, 901)
                return { items: [{ label: secondName, createdAt: 900 }] }
            }
        },
        volumes: {
            delete: async (...args: unknown[]) => {
                deleted.push(args)
            }
        }
    } as unknown as ConstructorParameters<typeof ModalRunStorage>[0])
    await storage.deleteProject("project-a")
    assert.deepEqual(deleted, [
        [firstName, { allowMissing: true }],
        [secondName, { allowMissing: true }]
    ])
    assert.equal(pages, 2)
})

test("local storage survives provider replacement and project cleanup preserves other projects", async t => {
    const root = await mkdtemp(join(tmpdir(), "terse-run-storage-"))
    t.after(() => rm(root, { recursive: true, force: true }))
    const storage = new LocalRunStorage(root)
    const first = await storage.prepare("project-a", "../run")
    await writeFile(join(first.path, "draft.txt"), "saved draft")
    const replacement = new LocalRunStorage(root)
    const retry = await replacement.prepare("project-a", "../run")
    assert.equal(first.path, retry.path)
    assert.equal(await readFile(join(retry.path, "draft.txt"), "utf8"), "saved draft")
    assert.equal(retry.syncMode, "local")
    const other = await replacement.prepare("project-b", "../run")
    await writeFile(join(other.path, "draft.txt"), "other project")
    await storage.deleteProject("project-a")
    await assert.rejects(readFile(join(first.path, "draft.txt")), { code: "ENOENT" })
    assert.equal(await readFile(join(other.path, "draft.txt"), "utf8"), "other project")
})
