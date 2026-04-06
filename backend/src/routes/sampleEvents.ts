import { Request, Response } from "express"
import { ConfigType } from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"
import type { User } from "terse-types/types"
import type { SerializedEvent, TriggerPayload } from "terse-types/types"

import { fetchSampleEvents } from "../integrations/abstract/sampleEvents"
import logger from "../logger"
import { sdkSampleEventsRequestSchema } from "terse-types/types"
import { extractErrorMessage } from "../utility/strings"

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

    const { triggers } = sdkSampleEventsRequestSchema.parse(req.body)

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

            const inputEvents = await fetchSampleEvents(integrationId, integrationType, configInstance, user.organizationId, user.id, { limit: 5 })

            for (const evt of inputEvents) {
                events.push({
                    integrationType: evt.integrationType,
                    eventType: evt.eventType,
                    formattedContent: evt.formatForAgentRunner(),
                    debugLog: evt.debugLog(),
                    metadata: evt.serializeMetadata()
                })
            }
        } catch (err) {
            // Skip integrations that don't support sample events or that error
            logger.warn("[sample-events] Skipping trigger due to error", {
                integrationType,
                error: extractErrorMessage(err)
            })
        }
    }

    return res.json({ events })
}
