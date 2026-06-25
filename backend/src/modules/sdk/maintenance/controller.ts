import logger from "../../../common/logger"
import { deleteExpiredApiTokens } from "../../../modules/auth/helpers/apiTokens"
import { SdkSandboxImageService } from "../../../services/SdkSandboxImageService"

export interface CleanupSdkImagesOptions {
    sourceImageGraceHours?: number
    dependencyImageGraceHours?: number
    batchSize?: number
}

/** Core logic for the SDK-image cleanup cron. Callable from the HTTP route and the BullMQ worker. */
export async function runCleanupSdkImages(opts: CleanupSdkImagesOptions = {}) {
    const result = await new SdkSandboxImageService().cleanupUnusedImages(opts)

    const deletedExpiredTokens = await deleteExpiredApiTokens().catch(error => {
        logger.error("Failed to delete expired API tokens", { error })
        return 0
    })

    logger.info("SDK image cleanup cron job completed", {
        deletedSourceImages: result.deletedSourceImages,
        deletedDependencyImages: result.deletedDependencyImages,
        deletedExpiredTokens,
        failures: result.failures.length
    })

    return { ...result, deletedExpiredTokens }
}
