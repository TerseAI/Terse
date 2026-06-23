import { AlreadyExistsError, App as ModalApp, ModalClient, Image as ModalImage, Sandbox as ModalSandbox, Volume as ModalVolume, NotFoundError, SandboxCreateParams } from "modal"

import logger from "../../common/logger"
import { shellQuote } from "../../common/shellEscape"
import { SettingsDependant } from "../../settings"
import { MEMORY_MOUNT_PATH, SDK_SANDBOX_APP_NAME, projectVolumeName, runtimeSandboxUniqueName } from "../sdkSandboxLayerKeys"

import { Sandbox, SandboxApp, SandboxImage, SandboxService, SandboxVolume, VolumeDirEntry, VolumeFs } from "./SandboxService"

export const SANDBOX_DEFAULT_OPTIONS: SandboxCreateParams = {
    idleTimeoutMs: 5 * 60 * 1000,
    timeoutMs: 24 * 60 * 60 * 1000
}

const CREATE_MAX_ATTEMPTS = 6
const CREATE_RETRY_BASE_DELAY_MS = 150

export class ModalSandboxService extends SettingsDependant implements SandboxService<ModalImage, ModalSandbox> {
    readonly settingsKey = "modal"
    readonly supportsContainerizedRunners = true

    private readonly modal = new ModalClient({
        tokenId: this.config.tokenId,
        tokenSecret: this.config.tokenSecret
    })

    getProjectPath(_sandbox: ModalSandbox): string {
        return "/opt/terse-sdk-run/project"
    }

    getDependencyCachePath(_sandbox: ModalSandbox, runtime: string): string {
        return `/opt/terse-sdk-cache/${runtime}/project`
    }

    getCliCachePath(_sandbox: ModalSandbox): string {
        return `/opt/terse-sdk-cache/cli`
    }

    getScratchPath(_sandbox: ModalSandbox, filename: string): string {
        // Each Modal sandbox has its own isolated filesystem, so /tmp is per-sandbox.
        return `/tmp/${filename}`
    }

    async getOrCreateApp(name: string): Promise<SandboxApp> {
        const t0 = Date.now()
        try {
            const app = await this.modal.apps.fromName(name, { createIfMissing: true })
            logger.info("Modal app: ready", { app: name, durationMs: Date.now() - t0 })
            return app
        } catch (error) {
            logger.error("Modal app: fromName failed", { app: name, durationMs: Date.now() - t0, errorMessage: errorMessage(error) })
            throw error
        }
    }

    getImageFromRegistry(registry: string): ModalImage {
        return this.modal.images.fromRegistry(registry)
    }

    async getImageFromId(imageId: string): Promise<ModalImage> {
        const t0 = Date.now()
        try {
            const image = await this.modal.images.fromId(imageId)
            logger.info("Modal image: fromId", { imageId, durationMs: Date.now() - t0 })
            return image
        } catch (error) {
            logger.error("Modal image: fromId failed", { imageId, durationMs: Date.now() - t0, errorMessage: errorMessage(error) })
            throw error
        }
    }

    async imageExists(imageId: string): Promise<boolean> {
        try {
            await this.modal.images.fromId(imageId)
            return true
        } catch (error) {
            if (error instanceof NotFoundError) return false
            throw error
        }
    }

    async deleteImage(imageId: string): Promise<void> {
        const t0 = Date.now()
        try {
            await this.modal.images.delete(imageId)
            logger.info("Modal image: deleted", { imageId, durationMs: Date.now() - t0 })
        } catch (error) {
            logger.error("Modal image: delete failed", { imageId, durationMs: Date.now() - t0, errorMessage: errorMessage(error) })
            throw error
        }
    }

    async getOrCreateSandbox(app: SandboxApp, image: ModalImage, uniqueName: string, params?: SandboxCreateParams): Promise<ModalSandbox> {
        if (!app.name) {
            throw new Error("App name is required")
        }

        const name = this.fullSandboxName(app.name, uniqueName)
        const opStart = Date.now()

        logger.info("Modal sandbox: getOrCreate begin", {
            app: app.name,
            name,
            imageId: image.imageId,
            timeoutMs: params?.timeoutMs,
            idleTimeoutMs: params?.idleTimeoutMs
        })

        const existing = await this.lookupLiveSandbox(app.name, name, opStart)
        if (existing) {
            return existing
        }

        return this.createSandboxWithRetries(app, image, name, params, opStart)
    }

    async terminateSandbox(app: SandboxApp, uniqueName: string): Promise<void> {
        if (!app.name) {
            throw new Error("App name is required")
        }

        const name = this.fullSandboxName(app.name, uniqueName)

        try {
            const sandbox = await this.modal.sandboxes.fromName(app.name, name)
            await this.terminateStaleSandbox(sandbox, app.name, name)
        } catch (error) {
            if (error instanceof NotFoundError) {
                logger.info("Modal sandbox: terminate found nothing to terminate", { app: app.name, name })
                return
            }

            logger.warn("Modal sandbox: terminate lookup failed, continuing", {
                app: app.name,
                name,
                errorMessage: errorMessage(error)
            })
        }
    }

    private fullSandboxName(appName: string, uniqueName: string): string {
        return `${appName}__${uniqueName}`
    }

    async getExistingSandbox(app: SandboxApp, uniqueName: string): Promise<ModalSandbox | null> {
        if (!app.name) {
            throw new Error("App name is required")
        }
        return this.lookupLiveSandbox(app.name, this.fullSandboxName(app.name, uniqueName), Date.now())
    }

    async getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume> {
        const name = projectVolumeName(projectId)
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
        logger.info("Modal volume: ensured project volume (v2)", { projectId, name, volumeId: resp.volumeId, durationMs: Date.now() - t0 })
        return volume
    }

    async deleteProjectVolume(projectId: string): Promise<void> {
        const name = projectVolumeName(projectId)
        try {
            await this.modal.volumes.delete(name)
            logger.info("Modal volume: deleted project volume", { projectId, name })
        } catch (error) {
            if (error instanceof NotFoundError) return
            logger.warn("Modal volume: delete project volume failed, continuing", { projectId, name, errorMessage: errorMessage(error) })
        }
    }

    async getProjectVolumeFs(projectId: string): Promise<VolumeFs> {
        const app = await this.getOrCreateApp(SDK_SANDBOX_APP_NAME)
        const existing = await this.getExistingSandbox(app, runtimeSandboxUniqueName(projectId))
        if (existing) {
            logger.info("Modal volume: attached fs to live runtime sandbox", { projectId, mountPath: MEMORY_MOUNT_PATH, sandboxId: existing.sandboxId })
            return new ModalVolumeFs(existing, MEMORY_MOUNT_PATH, null)
        }

        // No live runtime sandbox (e.g. memory op outside a run, such as agent-delete purge): spin up a
        // throwaway minimal sandbox with the volume mounted, which dispose() terminates.
        const volume = (await this.getOrCreateProjectVolume(projectId)) as ModalVolume
        const image = this.getImageFromRegistry("alpine:3")
        const sb = await this.modal.sandboxes.create(app as ModalApp, image, {
            ...SANDBOX_DEFAULT_OPTIONS,
            volumes: { [MEMORY_MOUNT_PATH]: volume }
        })
        logger.info("Modal volume: attached fs via ephemeral sandbox (no live runtime sandbox)", { projectId, mountPath: MEMORY_MOUNT_PATH, sandboxId: sb.sandboxId })
        return new ModalVolumeFs(sb, MEMORY_MOUNT_PATH, sb)
    }

    private async lookupLiveSandbox(appName: string, name: string, opStart: number): Promise<ModalSandbox | null> {
        const lookupStart = Date.now()

        try {
            const sandbox = await this.modal.sandboxes.fromName(appName, name)
            const status = await sandbox.poll()

            if (status === null && (await this.livenessProbe(sandbox, appName, name))) {
                logger.info("Modal sandbox: reused existing", {
                    app: appName,
                    name,
                    sandboxId: sandbox.sandboxId,
                    lookupDurationMs: Date.now() - lookupStart,
                    totalDurationMs: Date.now() - opStart
                })
                return sandbox
            }

            logger.info("Modal sandbox: stale existing sandbox found", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                pollStatus: status,
                lookupDurationMs: Date.now() - lookupStart
            })

            await this.terminateStaleSandbox(sandbox, appName, name)
            return null
        } catch (error) {
            if (error instanceof NotFoundError) {
                logger.info("Modal sandbox: not found, will create", {
                    app: appName,
                    name,
                    lookupDurationMs: Date.now() - lookupStart
                })
                return null
            }

            logger.error("Modal sandbox: lookup failed", {
                app: appName,
                name,
                lookupDurationMs: Date.now() - lookupStart,
                errorMessage: errorMessage(error)
            })
            throw error
        }
    }

    /** terminate() is a no-op if the sandbox already finished (Modal docs). */
    private async terminateStaleSandbox(sandbox: Sandbox, appName: string, name: string): Promise<void> {
        const t0 = Date.now()

        try {
            await sandbox.terminate()
            logger.info("Modal sandbox: stale terminated", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                durationMs: Date.now() - t0
            })
        } catch (error) {
            logger.warn("Modal sandbox: stale terminate failed, continuing", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                durationMs: Date.now() - t0,
                errorMessage: errorMessage(error)
            })
        }
    }

    private async createSandboxWithRetries(app: SandboxApp, image: SandboxImage, name: string, params: SandboxCreateParams | undefined, opStart: number): Promise<ModalSandbox> {
        const imageRef = image as ModalImage

        for (let attempt = 0; attempt < CREATE_MAX_ATTEMPTS; attempt++) {
            try {
                return await this.createSandboxOnce(app, image, name, params, attempt, opStart)
            } catch (error) {
                if (!(error instanceof AlreadyExistsError) || attempt === CREATE_MAX_ATTEMPTS - 1) {
                    logger.error("Modal sandbox: create failed", {
                        app: app.name,
                        name,
                        imageId: imageRef.imageId,
                        attempt,
                        errorMessage: errorMessage(error)
                    })
                    throw error
                }

                const recovered = await this.recoverFromCreateConflict(app.name!, name, attempt, opStart)
                if (recovered) {
                    return recovered
                }
            }
        }

        throw new Error(`Modal sandbox: exhausted create attempts for ${name}`)
    }

    private async createSandboxOnce(app: SandboxApp, image: SandboxImage, name: string, params: SandboxCreateParams | undefined, attempt: number, opStart: number): Promise<ModalSandbox> {
        const appRef = app as ModalApp
        const imageRef = image as ModalImage
        const createStart = Date.now()

        logger.info("Modal sandbox: create begin", {
            app: app.name,
            name,
            imageId: imageRef.imageId,
            timeoutMs: params?.timeoutMs,
            idleTimeoutMs: params?.idleTimeoutMs,
            attempt
        })
        const sandbox = await this.modal.sandboxes.create(appRef, imageRef, { ...params, name })

        logger.info("Modal sandbox: created new", {
            app: app.name,
            name,
            sandboxId: sandbox.sandboxId,
            imageId: imageRef.imageId,
            createDurationMs: Date.now() - createStart,
            totalDurationMs: Date.now() - opStart
        })

        return sandbox
    }

    private async recoverFromCreateConflict(appName: string, name: string, attempt: number, opStart: number): Promise<ModalSandbox | null> {
        const recoveryStart = Date.now()

        logger.warn("Modal sandbox: name conflict on create, attempting recovery", {
            app: appName,
            name,
            attempt
        })

        try {
            const sandbox = await this.modal.sandboxes.fromName(appName, name)
            const status = await sandbox.poll()

            if (status === null && (await this.livenessProbe(sandbox, appName, name))) {
                logger.info("Modal sandbox: conflict resolved by reusing live sandbox", {
                    app: appName,
                    name,
                    sandboxId: sandbox.sandboxId,
                    recoveryDurationMs: Date.now() - recoveryStart,
                    totalDurationMs: Date.now() - opStart
                })
                return sandbox
            }

            logger.info("Modal sandbox: conflict held by stale sandbox", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                pollStatus: status
            })

            await this.terminateStaleSandbox(sandbox, appName, name)
        } catch (error) {
            logger.warn("Modal sandbox: recovery lookup failed, will retry create", {
                app: appName,
                name,
                errorMessage: errorMessage(error)
            })
        }

        await this.waitBeforeRetry(appName, name, attempt)
        return null
    }

    private async waitBeforeRetry(appName: string, name: string, attempt: number): Promise<void> {
        const delayMs = createRetryDelayMs(attempt)

        logger.info("Modal sandbox: waiting before recreate retry", {
            app: appName,
            name,
            attempt,
            nextAttempt: attempt + 1,
            delayMs
        })

        await sleep(delayMs)
    }

    private async livenessProbe(sandbox: Sandbox, appName: string, name: string): Promise<boolean> {
        const t0 = Date.now()
        try {
            const proc = await sandbox.exec(["true"], { stdout: "pipe", stderr: "pipe" })
            const exitCode = await proc.wait()
            if (exitCode === 0) {
                logger.info("Modal sandbox: liveness probe ok", {
                    app: appName,
                    name,
                    sandboxId: sandbox.sandboxId,
                    probeDurationMs: Date.now() - t0
                })
                return true
            }
            logger.info("Modal sandbox: liveness probe non-zero exit, treating as stale", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                probeExitCode: exitCode,
                probeDurationMs: Date.now() - t0
            })
            return false
        } catch (error) {
            logger.info("Modal sandbox: liveness probe threw, treating as stale", {
                app: appName,
                name,
                sandboxId: sandbox.sandboxId,
                probeDurationMs: Date.now() - t0,
                errorMessage: errorMessage(error)
            })
            return false
        }
    }
}

// Minimal view of the SDK-internal control-plane RPC used to force Volumes v2. See getOrCreateProjectVolume.
interface VolumeGetOrCreateRpc {
    volumeGetOrCreate(req: { deploymentName: string; environmentName: string; objectCreationType: number; appId: string; version: number }): Promise<{ volumeId: string }>
}

/**
 * VolumeFs over a Modal sandbox with the project volume mounted at `mountPath`. File logic stays here;
 * primitives run via sandbox exec/open against the mount. Mutations are committed with `sync` (v2).
 */
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
        if (res.exitCode === 0) {
            logger.info("Modal volume: committed (sync)", { mountPath: this.mountPath, sandboxId: this.sb.sandboxId, durationMs: Date.now() - t0 })
        } else {
            logger.warn("Modal volume: sync returned non-zero exit", { mountPath: this.mountPath, sandboxId: this.sb.sandboxId, exitCode: res.exitCode, stderr: res.stderr.trim().slice(0, 200) })
        }
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

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const createRetryDelayMs = (attempt: number): number => {
    const exponential = CREATE_RETRY_BASE_DELAY_MS * 2 ** attempt
    const jitter = Math.floor(Math.random() * 100)
    return Math.min(exponential + jitter, 2000)
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export type { Sandbox, SandboxService }
