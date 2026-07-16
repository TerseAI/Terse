import axios from "axios"
import { z } from "zod"

import logger from "../common/logger"
import { settings } from "../settings"

export const LITELLM_MAIN_MODEL = "claude-opus-4-8"
export const LITELLM_SMALL_MODEL = "claude-haiku-4-5"

const keyGenerateResponse = z.object({ key: z.string() })

export class LiteLLMKeyService {
    async mintJobKey(jobId: string): Promise<string> {
        const litellm = settings.litellm
        if (!litellm) throw new Error("LiteLLM is not configured")

        const res = await axios.post(
            `${litellm.baseUrl}/key/generate`,
            {
                models: [LITELLM_MAIN_MODEL, LITELLM_SMALL_MODEL],
                max_budget: litellm.perJobBudgetUsd,
                duration: litellm.keyTtl,
                rpm_limit: litellm.rpm,
                metadata: { jobId }
            },
            { headers: { Authorization: `Bearer ${litellm.masterKey}` } }
        )

        return keyGenerateResponse.parse(res.data).key
    }

    async deleteKey(key: string): Promise<void> {
        const litellm = settings.litellm
        if (!litellm) return
        try {
            await axios.post(`${litellm.baseUrl}/key/delete`, { keys: [key] }, { headers: { Authorization: `Bearer ${litellm.masterKey}` } })
        } catch (error) {
            logger.warn("[LiteLLMKeyService] key/delete failed", { error })
        }
    }
}
