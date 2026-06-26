import { AlreadyExistsError, App as ModalApp, ModalClient, Image as ModalImage, Sandbox as ModalSandbox, NotFoundError, SandboxCreateParams } from "modal"

import logger from "../../common/logger"
import { SettingsDependant } from "../../settings"

import { Sandbox, SandboxApp, SandboxImage, SandboxService } from "./SandboxService"
import { withJournalVolume } from "./journalVolume"

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

        const name = `${app.name}__${uniqueName}`
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

        const createParams = await withJournalVolume(this.modal, params)
        const sandbox = await this.modal.sandboxes.create(appRef, imageRef, createParams)

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

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const createRetryDelayMs = (attempt: number): number => {
    const exponential = CREATE_RETRY_BASE_DELAY_MS * 2 ** attempt
    const jitter = Math.floor(Math.random() * 100)
    return Math.min(exponential + jitter, 2000)
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export type { Sandbox, SandboxService }
