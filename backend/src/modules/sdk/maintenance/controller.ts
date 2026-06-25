import { Request, Response } from "express"

import logger from "../../../common/logger"
import { deleteExpiredApiTokens } from "../../../modules/auth/helpers/apiTokens"
import { SdkSandboxImageService } from "../../../services/SdkSandboxImageService"

function parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid numeric cleanup parameter: ${value}`)
    return parsed
}

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

export async function cleanupSdkImages(req: Request, res: Response) {
    logger.info("SDK image cleanup cron job triggered")

    try {
        const result = await runCleanupSdkImages({
            sourceImageGraceHours: parseOptionalNumber(req.body?.sourceImageGraceHours),
            dependencyImageGraceHours: parseOptionalNumber(req.body?.dependencyImageGraceHours),
            batchSize: parseOptionalNumber(req.body?.batchSize)
        })

        return res.json({ message: "SDK image cleanup completed", ...result })
    } catch (error) {
        logger.error("Error in SDK image cleanup cron job", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}
