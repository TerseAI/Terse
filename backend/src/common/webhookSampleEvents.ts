import { Prisma, IntegrationType as PrismaIntegrationType } from "@prisma/client"
import type { SdkSampleEventRef as SampleEventRef, SdkSampleEventsResponse } from "terse-types"

import logger from "../logger"
import { db } from "../prismaClient"

import { parseSerializedTriggerPayload } from "./triggerPayload"
import { buildWebhookUrl } from "./webhookUrl"

const PAST_WEBHOOK_EVENTS_LIMIT = 5

export async function fetchWebhookSampleEvents(opts: { jobName: string; projectId: string; organizationId: string }): Promise<SdkSampleEventsResponse> {
    const { jobName, projectId, organizationId } = opts

    const automation = await db().automations.findFirst({
        where: { name: jobName, project_id: projectId, organization_id: organizationId },
        select: {
            id: true,
            inputs: {
                where: { config_type: "WEBHOOK_INPUT" },
                select: { id: true, webhook_config: { select: { webhook_token: true } } }
            }
        }
    })

    if (!automation) return { events: [], webhookEndpoints: [] }

    const webhookEndpoints = automation.inputs.filter(input => input.webhook_config).map(input => ({ triggerId: input.id, webhookUrl: buildWebhookUrl(input.webhook_config!.webhook_token) }))

    const records = await db().run_history_records.findMany({
        where: {
            automation_id: automation.id,
            trigger_integration: PrismaIntegrationType.WEBHOOK,
            trigger_payload: { not: Prisma.AnyNull }
        },
        orderBy: { timestamp: "desc" },
        take: PAST_WEBHOOK_EVENTS_LIMIT,
        select: { id: true, timestamp: true, trigger_payload: true }
    })

    const events: SampleEventRef[] = records.flatMap(record => {
        try {
            const event = parseSerializedTriggerPayload(record.trigger_payload)
            return event ? [{ serializedEvent: event, recordedAt: record.timestamp.toISOString() }] : []
        } catch (err) {
            logger.warn("[webhook-sample-events] Skipping run with malformed trigger_payload", { runId: record.id, err })
            return []
        }
    })

    return { events, webhookEndpoints }
}
