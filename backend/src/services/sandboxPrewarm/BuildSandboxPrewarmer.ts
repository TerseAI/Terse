import logger from "../../common/logger"
import { SandboxBaseImageResolver } from "../sandboxBaseImage/SandboxBaseImageResolver"
import { getSandboxProvider } from "../sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "../sandboxProvider/ModalSandboxService"
import { sdkRuntimeExecutorRegistry } from "../sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { prewarmBuildSandboxName } from "../sdkSandboxLayerKeys"

const BUILD_APP = "terse-sdk-image-builder"
const PREWARM_IDLE_TIMEOUT_MS = 3 * 60 * 1000
const BUILD_TIMEOUT_MS = 30 * 60 * 1000

export function prewarmBuildSandbox(objectKey: string): void {
    if (!getSandboxProvider().supportsContainerizedRunners) return

    void startPrewarm(objectKey).catch(error => {
        // A deploy that finds nothing warm just starts its own, so this is never worth failing over.
        logger.warn("Build sandbox prewarm failed", { objectKey, errorMessage: error instanceof Error ? error.message : String(error) })
    })
}

async function startPrewarm(objectKey: string): Promise<void> {
    const sandboxService = getSandboxProvider()
    const executor = sdkRuntimeExecutorRegistry.defaultExecutor()
    const baseImage = await SandboxBaseImageResolver.getInstance().resolve({
        releaseImageName: executor.releaseImageName,
        genericImage: executor.sandboxImage,
        usesLocalPackages: false,
        registryImagesSupported: true
    })

    const app = await sandboxService.getOrCreateApp(BUILD_APP)
    const sandbox = await sandboxService.getOrCreateSandbox(app, sandboxService.getImageFromRegistry(baseImage.reference), prewarmBuildSandboxName(objectKey), {
        ...SANDBOX_DEFAULT_OPTIONS,
        idleTimeoutMs: PREWARM_IDLE_TIMEOUT_MS,
        timeoutMs: BUILD_TIMEOUT_MS
    })

    // The container only becomes ready on first use, so pay that here rather than mid-deploy.
    const probe = await sandbox.exec(["sh", "-c", "true"], { stdout: "pipe", stderr: "pipe" })
    await probe.stdout.readText()
    await probe.wait()
    logger.info("Build sandbox: warmed during upload", { objectKey, sandboxId: sandbox.sandboxId })
}
