import { Request, Response } from "express"

import logger from "../logger"
import { SdkSandboxImageService } from "../services/SdkSandboxImageService"
import { validateCloudSchedulerRequest } from "../utility/cloudScheduler"

function parseOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid numeric cleanup parameter: ${value}`)
    }

    return parsed
}

export async function cleanupSdkImages(req: Request, res: Response) {
    logger.info("SDK image cleanup cron job triggered")

    if (!validateCloudSchedulerRequest(req, "CleanupSdkImages")) {
        logger.error("Unauthorized: Request did not pass Cloud Scheduler validation")
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const sourceImageGraceHours = parseOptionalNumber(req.body?.sourceImageGraceHours)
        const dependencyImageGraceHours = parseOptionalNumber(req.body?.dependencyImageGraceHours)
        const batchSize = parseOptionalNumber(req.body?.batchSize)

        const result = await new SdkSandboxImageService().cleanupUnusedImages({
            sourceImageGraceHours,
            dependencyImageGraceHours,
            batchSize
        })

        logger.info("SDK image cleanup cron job completed", {
            deletedSourceImages: result.deletedSourceImages,
            deletedDependencyImages: result.deletedDependencyImages,
            failures: result.failures.length
        })

        return res.json({
            message: "SDK image cleanup completed",
            ...result
        })
    } catch (error) {
        logger.error("Error in SDK image cleanup cron job", { error })
        return res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error"
        })
    }
}
