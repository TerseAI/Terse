import logger from "../../../common/logger"
import { deleteExpiredApiTokens } from "../../../modules/auth/helpers/apiTokens"
import { SdkSandboxImageService } from "../../../services/SdkSandboxImageService"
import { sweepExpiredMemorySnapshots } from "../../../services/memory/memorySnapshots"

export interface CleanupSdkImagesOptions {
    sourceImageGraceHours?: number
    dependencyImageGraceHours?: number
    batchSize?: number
}

/** Core logic for the SDK-image cleanup cron. Callable from the HTTP route and the pg-boss worker. */
export async function runCleanupSdkImages(opts: CleanupSdkImagesOptions = {}) {
    const result = await new SdkSandboxImageService().cleanupUnusedImages(opts)

    const deletedExpiredTokens = await deleteExpiredApiTokens().catch(error => {
        logger.error("Failed to delete expired API tokens", { error })
        return 0
    })

    const memorySweep = await sweepExpiredMemorySnapshots().catch(error => {
        logger.error("Failed to sweep expired memory snapshots", { error })
        return { deletedSnapshots: 0, deletedBlobs: 0 }
    })

    logger.info("SDK image cleanup cron job completed", {
        deletedSourceImages: result.deletedSourceImages,
        deletedDependencyImages: result.deletedDependencyImages,
        deletedExpiredTokens,
        deletedMemorySnapshots: memorySweep.deletedSnapshots,
        deletedMemoryBlobs: memorySweep.deletedBlobs,
        failures: result.failures.length
    })

    return { ...result, deletedExpiredTokens, ...memorySweep }
}
