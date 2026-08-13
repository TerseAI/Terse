import logger from "../../common/logger"
import { settings } from "../../settings"

import { type ContainerRegistryClient, GoogleArtifactRegistryClient } from "./ContainerRegistryClient"

export class SandboxBaseImageResolver {
    private static instance: SandboxBaseImageResolver | undefined

    private cachedDigest: { reference: string; expiresAtMs: number } | undefined

    private constructor(
        private readonly registryClient: ContainerRegistryClient,
        private readonly config: SandboxImageSettings
    ) {}

    static getInstance(): SandboxBaseImageResolver {
        if (!SandboxBaseImageResolver.instance) {
            SandboxBaseImageResolver.instance = new SandboxBaseImageResolver(GoogleArtifactRegistryClient.fromSettings(), settings.sandboxImages)
        }
        return SandboxBaseImageResolver.instance
    }

    static createForTesting(registryClient: ContainerRegistryClient, config: SandboxImageSettings): SandboxBaseImageResolver {
        return new SandboxBaseImageResolver(registryClient, config)
    }

    async resolve(request: SandboxBaseImageRequest): Promise<ResolvedSandboxBaseImage> {
        if (!this.usesSandboxImage(request)) {
            return { kind: "generic", reference: request.genericImage }
        }

        const reference = await this.resolveDigestReference(request.releaseImageName)
        if (reference === undefined) {
            logger.info("Sandbox image unavailable, building from the generic base", { releaseImageName: request.releaseImageName })
            return { kind: "generic", reference: request.genericImage }
        }

        return { kind: "sandbox", reference }
    }

    private usesSandboxImage(request: SandboxBaseImageRequest): boolean {
        if (!this.config.enabled) return false

        // The local provider ignores registry images entirely, so a probe would buy nothing.
        if (!request.registryImagesSupported) return false

        // Dev hoisting replaces the published packages with local tarballs, so the baked CLI would be wrong.
        if (request.usesLocalPackages) return false

        return true
    }

    private async resolveDigestReference(releaseImageName: string): Promise<string | undefined> {
        if (this.cachedDigest && this.cachedDigest.expiresAtMs > Date.now()) {
            return this.cachedDigest.reference
        }

        const repository = `${this.config.repositoryPrefix}/${releaseImageName}`
        const digest = await this.registryClient.resolveDigest({ registry: this.config.registry, repository, tag: this.config.tag })
        if (digest === undefined) return undefined

        const reference = `${this.config.registry}/${repository}@${digest}`
        this.cachedDigest = { reference, expiresAtMs: Date.now() + this.config.probeTtlMs }
        return reference
    }
}

export interface SandboxImageSettings {
    enabled: boolean
    registry: string
    repositoryPrefix: string
    tag: string
    probeTtlMs: number
}

export interface SandboxBaseImageRequest {
    releaseImageName: string
    genericImage: string
    usesLocalPackages: boolean
    registryImagesSupported: boolean
}

export type ResolvedSandboxBaseImage = { kind: "generic" | "sandbox"; reference: string }
