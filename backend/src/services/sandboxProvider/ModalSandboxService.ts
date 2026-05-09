import { App as ModalApp, ModalClient, Image as ModalImage, NotFoundError, SandboxCreateParams } from "modal"

import { settings } from "../../config/settings"
import logger from "../../logger"

import { Sandbox, SandboxApp, SandboxImage, SandboxService } from "./SandboxService"

export const SANDBOX_DEFAULT_OPTIONS: SandboxCreateParams = {
    idleTimeoutMs: 5 * 60 * 1000, // If idle for 5 minutes, terminate the sandbox
    timeoutMs: 24 * 60 * 60 * 1000 // Keep sandbox running for 24 hours otherwise
}

export class ModalSandboxService implements SandboxService {
    private readonly modal: ModalClient

    constructor() {
        this.modal = new ModalClient({
            tokenId: settings.modal.tokenId,
            tokenSecret: settings.modal.tokenSecret
        })
    }

    getOrCreateApp(name: string): Promise<SandboxApp> {
        return this.modal.apps.fromName(name, { createIfMissing: true })
    }
    getImageFromRegistry(registry: string): SandboxImage {
        return this.modal.images.fromRegistry(registry)
    }
    async getImageFromId(imageId: string): Promise<SandboxImage> {
        return this.modal.images.fromId(imageId)
    }
    async deleteImage(imageId: string): Promise<void> {
        await this.modal.images.delete(imageId)
    }

    async getOrCreateSandbox(app: SandboxApp, image: SandboxImage, uniqueName: string, params?: SandboxCreateParams): Promise<Sandbox> {
        if (!app.name) {
            throw new Error("App name is required")
        }

        const canonicalSandboxName = `${app.name}__${uniqueName}`

        try {
            const sandbox = await this.modal.sandboxes.fromName(app.name, canonicalSandboxName)
            const status = await sandbox.poll()
            if (status === null) {
                logger.info("Modal sandbox: reused existing", {
                    app: app.name,
                    name: canonicalSandboxName,
                    sandboxId: sandbox.sandboxId
                })
                return sandbox
            }
        } catch (error) {
            if (!(error instanceof NotFoundError)) {
                throw error
            }
        }

        const appRef = app as ModalApp
        const imageRef = image as ModalImage

        logger.info("Modal sandbox: creating new", {
            app,
            image
        })

        const created = await this.modal.sandboxes.create(appRef, imageRef, {
            timeoutMs: params?.timeoutMs,
            idleTimeoutMs: params?.idleTimeoutMs,
            name: canonicalSandboxName
        })
        logger.info("Modal sandbox: created new", {
            app: app.name,
            name: canonicalSandboxName,
            sandboxId: created.sandboxId
        })
        return created
    }
}

export type { Sandbox, SandboxService }
