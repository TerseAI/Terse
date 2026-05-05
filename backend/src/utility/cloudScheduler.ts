import crypto from "crypto"
import { Request } from "express"

import { cloudScheduler } from "../config/settings"
import logger from "../logger"

export function validateCloudSchedulerRequest(req: Request, logContext?: string): boolean {
    const authHeader = req.headers["authorization"]
    const prefix = logContext ? `[${logContext}] ` : ""

    if (!authHeader) {
        logger.warn(`${prefix}Missing Authorization header`)
        return false
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader

    if (!secretsMatch(token, cloudScheduler.secret)) {
        logger.warn(`${prefix}Invalid cron secret token`)
        return false
    }

    return true
}

function secretsMatch(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8")
    const bBuf = Buffer.from(b, "utf8")
    if (aBuf.length !== bBuf.length) {
        return false
    }
    return crypto.timingSafeEqual(aBuf, bBuf)
}
