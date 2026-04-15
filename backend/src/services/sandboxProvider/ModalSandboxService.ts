import { ModalClient } from "modal"

import { settings } from "../../config/settings"

import { Sandbox, SandboxApp, SandboxImage, SandboxService } from "./SandboxService"

export class ModalSandboxService implements SandboxService {
    getOrCreateApp(name: string): Promise<SandboxApp> {
        const modal = this.createModalClient()
        return modal.apps.fromName(name, { createIfMissing: true })
    }
    getOrCreateImageFromRegistry(registry: string): SandboxImage {
        const modal = this.createModalClient()
        const image = modal.images.fromRegistry(registry)
        return {
            imageId: image.imageId
        }
    }
    async getOrCreateImageFromId(imageId: string): Promise<SandboxImage> {
        const modal = this.createModalClient()
        const image = await modal.images.fromId(imageId)
        return {
            imageId: image.imageId
        }
    }
    async deleteImage(imageId: string): Promise<void> {
        const modal = this.createModalClient()
        await modal.images.delete(imageId)
    }

    async getOrCreateSandbox(app: SandboxApp, image: SandboxImage, params?: { timeoutMs?: number; idleTimeoutMs?: number }): Promise<Sandbox> {
        const modal = this.createModalClient()
        if (!app.name) {
            throw new Error("App name is required")
        }
        const appRef = await modal.apps.fromName(app.name)
        const imageRef = await modal.images.fromId(image.imageId)
        return modal.sandboxes.create(appRef, imageRef, { timeoutMs: params?.timeoutMs, idleTimeoutMs: params?.idleTimeoutMs })
    }

    private createModalClient(): ModalClient {
        return new ModalClient({
            tokenId: settings.modal.tokenId,
            tokenSecret: settings.modal.tokenSecret
        })
    }
}

export type { Sandbox, SandboxApp, SandboxImage, SandboxService }
