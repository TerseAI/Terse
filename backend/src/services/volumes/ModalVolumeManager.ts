import { App as ModalApp, Image as ModalImage, Volume as ModalVolume, NotFoundError } from "modal"

import logger from "../../common/logger"
import { shellQuote } from "../../common/shellEscape"
import { ModalSandboxService, SANDBOX_DEFAULT_OPTIONS } from "../sandboxProvider/ModalSandboxService"
import { Sandbox, SandboxVolume } from "../sandboxProvider/SandboxService"
import { MEMORY_MOUNT_PATH, SDK_SANDBOX_APP_NAME, projectVolumeName, runtimeSandboxUniqueName } from "../sdkSandboxLayerKeys"

import { VolumeManager } from "./VolumeManager"
import { VolumeDirEntry, VolumeFs } from "./types"

const VOLUME_OPS_IMAGE = "debian:bookworm-slim"

/** Modal volume manager: owns all Modal-specific volume RPCs, the ephemeral accessor sandbox, and the
 *  attach-to-live-runner optimization. Borrows generic sandbox/image primitives from the sandbox provider. */
export class ModalVolumeManager implements VolumeManager {
    constructor(private readonly provider: ModalSandboxService) {}

    private get modal() {
        return this.provider.modalClient
    }

    async getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume> {
        return this.ensureVolume(projectVolumeName(projectId))
    }

    async deleteProjectVolume(projectId: string): Promise<void> {
        await this.deleteVolume(projectVolumeName(projectId))
    }

    async openProjectVolumeFs(projectId: string, runId?: string): Promise<VolumeFs> {
        // Attached: if a live runtime sandbox for this run already has the volume mounted, operate on it
        // directly (dispose is a no-op — we don't own that sandbox).
        if (runId) {
            const app = await this.provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
            const existing = await this.provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
            if (existing) {
                logger.info("Modal volume: attached fs to live runtime sandbox", { projectId, runId, mountPath: MEMORY_MOUNT_PATH, sandboxId: existing.sandboxId })
                return new ModalVolumeFs(existing, MEMORY_MOUNT_PATH, null)
            }
        }

        // Headless: mount the (durable) volume on a throwaway sandbox that dispose() terminates.
        const app = await this.provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
        const volume = await this.ensureVolume(projectVolumeName(projectId))
        const image = this.provider.getImageFromRegistry(VOLUME_OPS_IMAGE)
        const sb = await this.modal.sandboxes.create(app as ModalApp, image as ModalImage, {
            ...SANDBOX_DEFAULT_OPTIONS,
            volumes: { [MEMORY_MOUNT_PATH]: volume as ModalVolume }
        })
        logger.info("Modal volume: attached fs via ephemeral sandbox", { projectId, mountPath: MEMORY_MOUNT_PATH, sandboxId: sb.sandboxId })
        return new ModalVolumeFs(sb, MEMORY_MOUNT_PATH, sb)
    }

    private async ensureVolume(name: string): Promise<SandboxVolume> {
        // Modal's high-level volumes.fromName() cannot request a filesystem version, so we call the
        // control-plane VolumeGetOrCreate RPC directly to force Volumes v2 (required so `sync` can commit
        // memory writes from a JS-driven sandbox). This uses SDK-internal surface (cpClient + the proto
        // enums OBJECT_CREATION_TYPE_CREATE_IF_MISSING=1, VOLUME_FS_VERSION_V2=2) — re-verify on modal bumps.
        const t0 = Date.now()
        const cp = this.modal.cpClient as unknown as VolumeGetOrCreateRpc
        const resp = await cp.volumeGetOrCreate({
            deploymentName: name,
            environmentName: this.modal.environmentName(),
            objectCreationType: 1,
            appId: "",
            version: 2
        })
        const volume = await this.modal.volumes.fromName(name)
        logger.info("Modal volume: ensured volume (v2)", { name, volumeId: resp.volumeId, durationMs: Date.now() - t0 })
        return volume
    }

    private async deleteVolume(name: string): Promise<void> {
        try {
            await this.modal.volumes.delete(name)
            logger.info("Modal volume: deleted volume", { name })
        } catch (error) {
            if (error instanceof NotFoundError) return
            logger.warn("Modal volume: delete volume failed, continuing", { name, errorMessage: errorMessage(error) })
        }
    }
}

// Minimal view of the SDK-internal control-plane RPC used to force Volumes v2. See ensureVolume.
interface VolumeGetOrCreateRpc {
    volumeGetOrCreate(req: { deploymentName: string; environmentName: string; objectCreationType: number; appId: string; version: number }): Promise<{ volumeId: string }>
}

class ModalVolumeFs implements VolumeFs {
    constructor(
        private readonly sb: Sandbox,
        private readonly mountPath: string,
        private readonly ephemeral: Sandbox | null
    ) {}

    private abs(relPath: string): string {
        const clean = relPath.replace(/^\/+/, "")
        return clean ? `${this.mountPath}/${clean}` : this.mountPath
    }

    private async run(command: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        const proc = await this.sb.exec(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" })
        const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
        const exitCode = await proc.wait()
        return { exitCode, stdout, stderr }
    }

    async list(dirPath: string): Promise<VolumeDirEntry[]> {
        const abs = this.abs(dirPath)
        const res = await this.run(`find ${shellQuote(abs)} -maxdepth 1 -mindepth 1 -printf '%y\\t%s\\t%f\\n'`)
        if (res.exitCode !== 0) {
            throw new Error(res.stderr.trim() || `Failed to list ${dirPath}`)
        }
        return res.stdout
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const [type, size, ...nameParts] = line.split("\t")
                return { name: nameParts.join("\t"), isDirectory: type === "d", sizeBytes: Number(size) || 0 }
            })
    }

    async read(filePath: string): Promise<string | null> {
        try {
            const handle = await this.sb.open(this.abs(filePath), "r")
            try {
                const bytes = await handle.read()
                return new TextDecoder().decode(bytes)
            } finally {
                await handle.close()
            }
        } catch {
            return null
        }
    }

    async write(filePath: string, content: string): Promise<void> {
        await this.mkdirp(dirnameRel(filePath))
        const handle = await this.sb.open(this.abs(filePath), "w")
        try {
            await handle.write(new TextEncoder().encode(content))
            await handle.flush()
        } finally {
            await handle.close()
        }
    }

    async stat(path: string): Promise<{ isDirectory: boolean; sizeBytes: number } | null> {
        const res = await this.run(`stat -c '%F|%s' ${shellQuote(this.abs(path))} 2>/dev/null`)
        if (res.exitCode !== 0) return null
        const [kind, size] = res.stdout.trim().split("|")
        return { isDirectory: (kind ?? "").includes("directory"), sizeBytes: Number(size) || 0 }
    }

    async remove(path: string): Promise<void> {
        const res = await this.run(`rm -rf ${shellQuote(this.abs(path))}`)
        if (res.exitCode !== 0) throw new Error(res.stderr.trim() || `Failed to remove ${path}`)
    }

    async rename(fromPath: string, toPath: string): Promise<void> {
        const dest = this.abs(toPath)
        const res = await this.run(`mkdir -p ${shellQuote(dirnameAbs(dest))} && mv ${shellQuote(this.abs(fromPath))} ${shellQuote(dest)}`)
        if (res.exitCode !== 0) throw new Error(res.stderr.trim() || `Failed to rename ${fromPath}`)
    }

    async mkdirp(dirPath: string): Promise<void> {
        const abs = this.abs(dirPath)
        const res = await this.run(`mkdir -p ${shellQuote(abs)}`)
        if (res.exitCode !== 0) throw new Error(res.stderr.trim() || `Failed to mkdir ${dirPath}`)
    }

    async sync(): Promise<void> {
        // Volumes v2: flush + persist all data and metadata changes from the mount.
        const t0 = Date.now()
        const res = await this.run(`sync ${shellQuote(this.mountPath)}`)
        if (res.exitCode !== 0) {
            logger.error("Modal volume: sync returned non-zero exit", { mountPath: this.mountPath, sandboxId: this.sb.sandboxId, exitCode: res.exitCode, stderr: res.stderr.trim().slice(0, 200) })
            throw new Error(res.stderr.trim() || `Failed to sync ${this.mountPath} (exit ${res.exitCode})`)
        }
        logger.info("Modal volume: committed (sync)", { mountPath: this.mountPath, sandboxId: this.sb.sandboxId, durationMs: Date.now() - t0 })
    }

    async dispose(): Promise<void> {
        if (this.ephemeral) {
            logger.info("Modal volume: terminating ephemeral volume sandbox", { sandboxId: this.ephemeral.sandboxId })
            await this.ephemeral.terminate().catch(() => {})
        }
    }
}

function dirnameRel(relPath: string): string {
    const clean = relPath.replace(/^\/+/, "")
    const idx = clean.lastIndexOf("/")
    return idx === -1 ? "" : clean.slice(0, idx)
}

function dirnameAbs(absPath: string): string {
    const idx = absPath.lastIndexOf("/")
    return idx <= 0 ? "/" : absPath.slice(0, idx)
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
