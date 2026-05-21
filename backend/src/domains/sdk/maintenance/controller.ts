import { Request, Response } from "express"

import logger from "../../../common/logger"
import { SdkSandboxImageService } from "../../../services/SdkSandboxImageService"
import { deleteExpiredApiTokens } from "../../../utility/apiTokens"

function parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid numeric cleanup parameter: ${value}`)
    return parsed
}

export async function cleanupSdkImages(req: Request, res: Response) {
    logger.info("SDK image cleanup cron job triggered")

    try {
        const sourceImageGraceHours = parseOptionalNumber(req.body?.sourceImageGraceHours)
        const dependencyImageGraceHours = parseOptionalNumber(req.body?.dependencyImageGraceHours)
        const batchSize = parseOptionalNumber(req.body?.batchSize)

        const result = await new SdkSandboxImageService().cleanupUnusedImages({ sourceImageGraceHours, dependencyImageGraceHours, batchSize })

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

        return res.json({ message: "SDK image cleanup completed", ...result, deletedExpiredTokens })
    } catch (error) {
        logger.error("Error in SDK image cleanup cron job", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}
