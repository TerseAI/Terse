import { Request, Response } from "express"

import logger from "../logger"
import { AnthropicAdminService } from "../services/AnthropicAdminService"

const ORPHAN_AGE_MS = 30 * 60 * 1000

export async function reapOrphanAnthropicKeys(_req: Request, res: Response): Promise<Response> {
    logger.info("[AnthropicKeyReaper] Starting reap")
    try {
        const admin = new AnthropicAdminService()
        const keys = await admin.listImprovementKeys()
        const cutoff = Date.now() - ORPHAN_AGE_MS

        const reaped: string[] = []
        const skipped: string[] = []
        const failed: Array<{ keyId: string; error: string }> = []

        for (const key of keys) {
            const createdMs = Date.parse(key.created_at)
            if (Number.isNaN(createdMs) || createdMs > cutoff) {
                skipped.push(key.id)
                continue
            }
            if (key.status === "inactive" || key.status === "archived") {
                skipped.push(key.id)
                continue
            }
            try {
                await admin.revokeKey(key.id)
                reaped.push(key.id)
            } catch (error) {
                failed.push({ keyId: key.id, error: error instanceof Error ? error.message : String(error) })
            }
        }

        logger.info("[AnthropicKeyReaper] Done", { reaped: reaped.length, skipped: skipped.length, failed: failed.length })
        return res.json({ reaped, skipped, failed })
    } catch (error) {
        logger.error("[AnthropicKeyReaper] Failed", { error })
        return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" })
    }
}
