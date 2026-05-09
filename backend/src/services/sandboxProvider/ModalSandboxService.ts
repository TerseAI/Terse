import { AlreadyExistsError, App as ModalApp, ModalClient, Image as ModalImage, NotFoundError, SandboxCreateParams } from "modal"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { extractErrorFields } from "../../utility/strings"

import { Sandbox, SandboxApp, SandboxImage, SandboxService } from "./SandboxService"

// Modal's documented sandbox defaults are 5 min lifetime; we extend ours to 24 h so a single named
// sandbox can serve many runs. Idle timeout still bounds free-floating sandboxes.
// Refs:
//   - https://modal.com/docs/guide/sandboxes ("Sandboxes have a default maximum lifetime of 5 minutes... up to 24 hours")
export const SANDBOX_DEFAULT_OPTIONS: SandboxCreateParams = {
    idleTimeoutMs: 5 * 60 * 1000,
    timeoutMs: 24 * 60 * 60 * 1000
}

export class ModalSandboxService implements SandboxService {
    private readonly modal: ModalClient

    constructor(modal?: ModalClient) {
        this.modal = modal ?? new ModalClient({
            tokenId: settings.modal.tokenId,
            tokenSecret: settings.modal.tokenSecret
        })
    }

    async getOrCreateApp(name: string): Promise<SandboxApp> {
        const t0 = Date.now()
        try {
            const app = await this.modal.apps.fromName(name, { createIfMissing: true })
            logger.info("Modal app: ready", { app: name, durationMs: Date.now() - t0 })
            return app
        } catch (error) {
            logger.error("Modal app: fromName failed", { app: name, durationMs: Date.now() - t0, ...extractErrorFields(error) })
            throw error
        }
    }

    getImageFromRegistry(registry: string): SandboxImage {
        // Local config-only call; logged at debug-equivalent (info kept low-cardinality).
        return this.modal.images.fromRegistry(registry)
    }

    async getImageFromId(imageId: string): Promise<SandboxImage> {
        const t0 = Date.now()
        try {
            const image = await this.modal.images.fromId(imageId)
            logger.info("Modal image: fromId", { imageId, durationMs: Date.now() - t0 })
            return image
        } catch (error) {
            logger.error("Modal image: fromId failed", { imageId, durationMs: Date.now() - t0, ...extractErrorFields(error) })
            throw error
        }
    }

    async deleteImage(imageId: string): Promise<void> {
        const t0 = Date.now()
        try {
            await this.modal.images.delete(imageId)
            logger.info("Modal image: deleted", { imageId, durationMs: Date.now() - t0 })
        } catch (error) {
            logger.error("Modal image: delete failed", { imageId, durationMs: Date.now() - t0, ...extractErrorFields(error) })
            throw error
        }
    }

    async getOrCreateSandbox(app: SandboxApp, image: SandboxImage, uniqueName: string, params?: SandboxCreateParams): Promise<Sandbox> {
        if (!app.name) {
            throw new Error("App name is required")
        }

        const canonicalSandboxName = `${app.name}__${uniqueName}`
        const imageId = (image as ModalImage).imageId
        const opStart = Date.now()

        logger.info("Modal sandbox: getOrCreate begin", {
            app: app.name,
            name: canonicalSandboxName,
            imageId,
            timeoutMs: params?.timeoutMs,
            idleTimeoutMs: params?.idleTimeoutMs
        })

        // Phase 1: lookup. fromName throws NotFoundError when no sandbox by this name exists.
        // Per Modal docs, fromName "only" returns running sandboxes — but we've observed in prod
        // that it can return a sandbox whose poll() is non-null (recently terminated, name
        // still registered). We treat any non-null poll() as "stale" and clean it up.
        // Refs:
        //   - https://modal.com/docs/guide/sandboxes (fromName + name-reuse semantics)
        //   - https://modal.com/docs/reference/modal.Sandbox (poll() returns None while running)
        try {
            const lookupStart = Date.now()
            const existing = await this.modal.sandboxes.fromName(app.name, canonicalSandboxName)
            const status = await existing.poll()
            const lookupDurationMs = Date.now() - lookupStart

            if (status === null) {
                logger.info("Modal sandbox: reused existing", {
                    app: app.name,
                    name: canonicalSandboxName,
                    sandboxId: existing.sandboxId,
                    lookupDurationMs,
                    totalDurationMs: Date.now() - opStart
                })
                return existing
            }

            logger.info("Modal sandbox: stale, terminating before recreate", {
                app: app.name,
                name: canonicalSandboxName,
                sandboxId: existing.sandboxId,
                pollStatus: status,
                lookupDurationMs
            })
            // Modal docs: terminate() is a no-op if the sandbox already finished — safe to call
            // even when poll() shows it stopped. Helps free the registered name promptly.
            // Ref: https://modal.com/docs/reference/modal.Sandbox#terminate
            const terminateStart = Date.now()
            try {
                await existing.terminate()
                logger.info("Modal sandbox: stale terminated", {
                    app: app.name,
                    name: canonicalSandboxName,
                    sandboxId: existing.sandboxId,
                    durationMs: Date.now() - terminateStart
                })
            } catch (terminateError) {
                logger.warn("Modal sandbox: terminate of stale failed (continuing to create)", {
                    app: app.name,
                    name: canonicalSandboxName,
                    sandboxId: existing.sandboxId,
                    durationMs: Date.now() - terminateStart,
                    ...extractErrorFields(terminateError)
                })
            }
        } catch (error) {
            if (error instanceof NotFoundError) {
                logger.info("Modal sandbox: not found, will create", {
                    app: app.name,
                    name: canonicalSandboxName,
                    lookupDurationMs: Date.now() - opStart
                })
            } else {
                logger.error("Modal sandbox: lookup failed", {
                    app: app.name,
                    name: canonicalSandboxName,
                    lookupDurationMs: Date.now() - opStart,
                    ...extractErrorFields(error)
                })
                throw error
            }
        }

        // Phase 2: create. Recurses once on AlreadyExistsError to recover from the concurrent-caller
        // race (or from terminate() not yet having freed the name in Modal's registry).
        return this.createSandbox(app, image, canonicalSandboxName, params, true, opStart)
    }

    private async createSandbox(
        app: SandboxApp,
        image: SandboxImage,
        canonicalSandboxName: string,
        params: SandboxCreateParams | undefined,
        allowConflictRecovery: boolean,
        opStart: number
    ): Promise<Sandbox> {
        if (!app.name) {
            throw new Error("App name is required")
        }
        const appRef = app as ModalApp
        const imageRef = image as ModalImage
        const imageId = imageRef.imageId
        const createStart = Date.now()

        logger.info("Modal sandbox: create begin", {
            app: app.name,
            name: canonicalSandboxName,
            imageId,
            timeoutMs: params?.timeoutMs,
            idleTimeoutMs: params?.idleTimeoutMs,
            allowConflictRecovery
        })

        try {
            const created = await this.modal.sandboxes.create(appRef, imageRef, {
                timeoutMs: params?.timeoutMs,
                idleTimeoutMs: params?.idleTimeoutMs,
                name: canonicalSandboxName
            })
            logger.info("Modal sandbox: created new", {
                app: app.name,
                name: canonicalSandboxName,
                sandboxId: created.sandboxId,
                imageId,
                createDurationMs: Date.now() - createStart,
                totalDurationMs: Date.now() - opStart
            })
            return created
        } catch (error) {
            // AlreadyExistsError: the gRPC ALREADY_EXISTS code coming back from Modal.
            // Refs:
            //   - libmodal source: https://github.com/modal-labs/libmodal/blob/main/modal-js/src/sandbox.ts
            //     (catches ClientError code === Status.ALREADY_EXISTS, throws AlreadyExistsError)
            //   - exported from the public 'modal' package via modal-js/src/index.ts
            if (allowConflictRecovery && error instanceof AlreadyExistsError) {
                logger.warn("Modal sandbox: name conflict on create, attempting recovery", {
                    app: app.name,
                    name: canonicalSandboxName,
                    createDurationMs: Date.now() - createStart,
                    ...extractErrorFields(error)
                })
                const recoveryStart = Date.now()
                try {
                    const existing = await this.modal.sandboxes.fromName(app.name, canonicalSandboxName)
                    const status = await existing.poll()
                    if (status === null) {
                        logger.info("Modal sandbox: conflict resolved by reusing peer-created sandbox", {
                            app: app.name,
                            name: canonicalSandboxName,
                            sandboxId: existing.sandboxId,
                            recoveryDurationMs: Date.now() - recoveryStart,
                            totalDurationMs: Date.now() - opStart
                        })
                        return existing
                    }
                    logger.info("Modal sandbox: conflict held by stale sandbox, terminating before recreate", {
                        app: app.name,
                        name: canonicalSandboxName,
                        sandboxId: existing.sandboxId,
                        pollStatus: status
                    })
                    await existing.terminate().catch((terminateError: unknown) => {
                        logger.warn("Modal sandbox: terminate during conflict recovery failed", {
                            app: app.name,
                            name: canonicalSandboxName,
                            sandboxId: existing.sandboxId,
                            ...extractErrorFields(terminateError)
                        })
                    })
                } catch (recoveryLookupError) {
                    logger.warn("Modal sandbox: recovery lookup failed, proceeding with single recreate attempt", {
                        app: app.name,
                        name: canonicalSandboxName,
                        ...extractErrorFields(recoveryLookupError)
                    })
                }
                // One non-recursive retry. allowConflictRecovery=false to ensure a second
                // AlreadyExistsError surfaces to the caller instead of looping.
                return this.createSandbox(app, image, canonicalSandboxName, params, false, opStart)
            }
            logger.error("Modal sandbox: create failed", {
                app: app.name,
                name: canonicalSandboxName,
                imageId,
                createDurationMs: Date.now() - createStart,
                allowConflictRecovery,
                ...extractErrorFields(error)
            })
            throw error
        }
    }
}

export type { Sandbox, SandboxService }
