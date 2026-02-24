import { Request, Response } from "express"

import { fetchSampleEvents } from "../integrations/abstract/sampleEvents"
import logger from "../logger"
import { ConfigType } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"
import type { User } from "../shared/types"
import type { SerializedEvent, TriggerPayload } from "../shared/types"

/**
 * Wraps a plain config object into something that satisfies ConfigInstance
 * for the integration manager's getSampleEvents() call.
 */
function toConfigInstance(config: Record<string, unknown>) {
    return {
        ...config,
        integrationId: (config.integrationId as string) ?? "",
        integrationType: (config.integrationType as IntegrationType) ?? IntegrationType.TERSE,
        configType: (config.configType as ConfigType) ?? ConfigType.TERSE,
        isComplete: () => true,
        formatForAgent: () => ""
    }
}

export async function handleSampleEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    console.log("🔍 Sample events request body:", req.body)

    const { triggers } = req.body as { triggers?: TriggerPayload[] }
    if (!triggers || !Array.isArray(triggers) || triggers.length === 0) {
        return res.status(400).json({ error: "Request body must include a non-empty `triggers` array" })
    }

    const events: SerializedEvent[] = []

    for (const trigger of triggers) {
        const { integrationId, integrationType, config } = trigger

        if (!integrationId || !integrationType) {
            logger.warn("[sample-events] Skipping trigger with missing fields", { trigger })
            continue
        }

        try {
            const configInstance = toConfigInstance({
                ...config,
                integrationId,
                integrationType
            })

            const inputEvents = await fetchSampleEvents(integrationId, integrationType, configInstance, user.organizationId, { limit: 5 })

            for (const evt of inputEvents) {
                events.push({
                    integrationType: evt.integrationType,
                    formattedContent: evt.formatForAgentRunner(),
                    debugLog: evt.debugLog()
                })
            }
        } catch (err) {
            // Skip integrations that don't support sample events or that error
            logger.warn("[sample-events] Skipping trigger due to error", {
                integrationType,
                error: err instanceof Error ? err.message : String(err)
            })
        }
    }

    return res.json({ events })
}
