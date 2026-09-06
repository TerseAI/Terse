import { Volume } from "modal"
import type { ModalClient } from "modal"
import { createHash } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"

import type { SandboxRunStorage } from "./SandboxService"

export const DURABLE_FOLDER = "/terse/durable"

export function runStorageVolumeName(projectId: string, runId: string): string {
    return `${projectVolumePrefix(projectId)}${storageKey(runId).slice(0, 32)}`
}

function projectVolumePrefix(projectId: string): string {
    return `tf2-${storageKey(projectId).slice(0, 24)}-`
}

function storageKey(id: string): string {
    return createHash("sha256").update(id).digest("hex")
}

/** Each run owns a volume, which outlives its sandboxes. */
export class ModalRunStorage {
    constructor(private readonly modal: Pick<ModalClient, "cpClient" | "environmentName" | "volumes">) {}

    async prepare(projectId: string, runId: string): Promise<SandboxRunStorage> {
        const name = runStorageVolumeName(projectId, runId)
        // modal-js 0.10's volumes.fromName does not expose the version option.
        // Explicitly request and verify v2: sync on a v1 volume is not a commit.
        const result = await this.modal.cpClient.volumeGetOrCreate({
            deploymentName: name,
            environmentName: this.modal.environmentName(),
            objectCreationType: 1, // CREATE_IF_MISSING
            version: 2 // VOLUME_FS_VERSION_V2
        })
        if (result.metadata?.version !== 2) throw new Error(`Durable folder requires a Modal Volume v2 (${name}).`)
        // Mount the entire volume. Live tests found that sync on a subPath mount
        // could return before its file contents were committed (Modal, Sep 2026).
        const volume = new Volume(result.volumeId, name)
        return { path: DURABLE_FOLDER, syncMode: "modal", volumes: { [DURABLE_FOLDER]: volume } }
    }

    async deleteProject(projectId: string): Promise<void> {
        const prefix = projectVolumePrefix(projectId)
        let createdBefore = 0
        while (true) {
            const page = await this.modal.cpClient.volumeList({
                environmentName: this.modal.environmentName(),
                pagination: { maxObjects: 100, createdBefore }
            })
            for (const item of page.items) {
                const name = item.metadata?.name ?? item.label
                if (name.startsWith(prefix) && /^[a-f0-9]{32}$/.test(name.slice(prefix.length))) {
                    await this.modal.volumes.delete(name, { allowMissing: true })
                }
            }
            if (page.items.length < 100) return
            const last = page.items[page.items.length - 1]
            const next = last.metadata?.creationInfo?.createdAt ?? last.createdAt
            if (!next || (createdBefore !== 0 && next >= createdBefore)) throw new Error("Cannot paginate durable volume cleanup.")
            createdBefore = next
        }
    }
}

/** Self-hosted files live on the host's persistent disk, outside disposable sandboxes. */
export class LocalRunStorage {
    constructor(private readonly root = "/data/sandbox/run-storage") {}

    async prepare(projectId: string, runId: string): Promise<SandboxRunStorage> {
        const path = join(this.root, storageKey(projectId), storageKey(runId))
        await mkdir(path, { recursive: true })
        return { path, syncMode: "local" }
    }

    async deleteProject(projectId: string): Promise<void> {
        await rm(join(this.root, storageKey(projectId)), { recursive: true, force: true })
    }
}
