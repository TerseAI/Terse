import logger from "../../common/logger"
import { SandboxBaseImageResolver } from "../sandboxBaseImage/SandboxBaseImageResolver"
import { getSandboxProvider } from "../sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "../sandboxProvider/ModalSandboxService"
import type { Sandbox } from "../sandboxProvider/SandboxService"
import { sdkRuntimeExecutorRegistry } from "../sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { deployBuildSandboxUniqueName } from "../sdkSandboxLayerKeys"

const BUILD_APP = "terse-sdk-image-builder"
const CLAIM_WINDOW_MS = 3 * 60 * 1000
const SWEEP_INTERVAL_MS = 30 * 1000

export class BuildSandboxPrewarmer {
    private static instance: BuildSandboxPrewarmer | undefined

    private readonly pending = new Map<string, PendingSandbox>()

    private constructor() {
        // Unref'd: a warm sandbox is never a reason to keep the process alive.
        setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS).unref()
    }

    static getInstance(): BuildSandboxPrewarmer {
        if (!BuildSandboxPrewarmer.instance) BuildSandboxPrewarmer.instance = new BuildSandboxPrewarmer()
        return BuildSandboxPrewarmer.instance
    }

    prewarm(key: string): void {
        if (!getSandboxProvider().supportsContainerizedRunners || this.pending.has(key)) return

        const sandbox = this.start().catch(error => {
            logger.warn("Build sandbox prewarm failed", { key, errorMessage: error instanceof Error ? error.message : String(error) })
            return undefined
        })

        this.pending.set(key, { sandbox, expiresAtMs: Date.now() + CLAIM_WINDOW_MS })
    }

    /** Hands over ownership: the caller terminates it, and a second claim gets nothing. */
    async claim(key: string | undefined): Promise<Sandbox | undefined> {
        if (key === undefined) return undefined

        const entry = this.pending.get(key)
        if (!entry) return undefined
        this.pending.delete(key)

        const sandbox = await entry.sandbox
        if (sandbox) logger.info("Build sandbox: using the one warmed during upload", { key, sandboxId: sandbox.sandboxId })
        return sandbox
    }

    /** For a deploy that turned out not to need it, e.g. an image cache hit. */
    async discard(key: string | undefined): Promise<void> {
        const sandbox = await this.claim(key)
        await terminate(sandbox)
    }

    private async start(): Promise<Sandbox> {
        const sandboxService = getSandboxProvider()
        const executor = sdkRuntimeExecutorRegistry.defaultExecutor()
        const baseImage = await SandboxBaseImageResolver.getInstance().resolve({
            releaseImageName: executor.releaseImageName,
            genericImage: executor.sandboxImage,
            usesLocalPackages: false,
            registryImagesSupported: true
        })

        const app = await sandboxService.getOrCreateApp(BUILD_APP)
        const sandbox = await sandboxService.getOrCreateSandbox(app, sandboxService.getImageFromRegistry(baseImage.reference), deployBuildSandboxUniqueName("prewarm"), {
            ...SANDBOX_DEFAULT_OPTIONS,
            timeoutMs: 30 * 60 * 1000
        })

        // The container only becomes ready on first use, so pay that here rather than mid-deploy.
        const probe = await sandbox.exec(["sh", "-c", "true"], { stdout: "pipe", stderr: "pipe" })
        await probe.stdout.readText()
        await probe.wait()
        return sandbox
    }

    private async sweep(): Promise<void> {
        const now = Date.now()
        for (const [key, entry] of this.pending) {
            if (entry.expiresAtMs > now) continue
            this.pending.delete(key)
            logger.info("Build sandbox: terminating a prewarm nobody claimed", { key })
            await terminate(await entry.sandbox)
        }
    }
}

async function terminate(sandbox: Sandbox | undefined): Promise<void> {
    if (!sandbox) return
    try {
        await sandbox.terminate()
    } catch (error) {
        logger.warn("Build sandbox: terminating a prewarm failed", { errorMessage: error instanceof Error ? error.message : String(error) })
    }
}

interface PendingSandbox {
    sandbox: Promise<Sandbox | undefined>
    expiresAtMs: number
}
