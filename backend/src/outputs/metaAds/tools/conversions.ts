import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { MetaAdsConversionEvent, MetaAdsSendConversionsRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { metaAdsToolExecute } from "./metaAdsApi"
import { MetaAdsClient, hashEmail, hashPhone } from "./metaAdsClient"

export const metaAdsSendConversionsTool = defineSessionTool({
    name: "meta_ads_send_conversions",
    execute: metaAdsToolExecute("meta_ads_send_conversions", executeSendConversionsRequest)
})

const sendEventsResponseSchema = z.object({
    events_received: z.number(),
    fbtrace_id: z.string().optional()
})

async function executeSendConversionsRequest(request: MetaAdsSendConversionsRequest, client: MetaAdsClient): Promise<MetaAdsSendConversionsOutput> {
    const response = await client.runParsed(() => client.adsPixel(request.datasetId).createEvent([], { data: request.events.map(toGraphEvent) }), sendEventsResponseSchema, "conversion events")

    return {
        success: true,
        datasetId: request.datasetId,
        eventsReceived: response.events_received,
        fbtraceId: response.fbtrace_id,
        actions: [
            {
                action: "Sent conversion events",
                integration: IntegrationType.META_ADS,
                target: request.datasetId,
                details: `Sent ${request.events.length} event(s); Meta received ${response.events_received}`,
                type: RunHistoryActionType.create
            }
        ]
    }
}

function toGraphEvent(event: MetaAdsConversionEvent): Record<string, unknown> {
    const userData = buildUserData(event)
    if (Object.keys(userData).length === 0) {
        throw new Error(`Event "${event.eventName}" has no user match keys; provide at least one of email, phone, externalId, clickId, or browserId.`)
    }
    if (event.value !== null && event.value !== undefined && !event.currency) {
        throw new Error(`Event "${event.eventName}" sets a value but no currency; currency is required when value is set.`)
    }

    return {
        event_name: event.eventName,
        event_time: event.eventTime,
        action_source: event.actionSource,
        user_data: userData,
        ...(event.eventId ? { event_id: event.eventId } : {}),
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        ...(event.value !== null && event.value !== undefined ? { custom_data: { value: event.value, currency: event.currency } } : {})
    }
}

function buildUserData(event: MetaAdsConversionEvent): Record<string, unknown> {
    const userData: Record<string, unknown> = {}
    if (event.userData.email) userData.em = [hashEmail(event.userData.email)]
    if (event.userData.phone) userData.ph = [hashPhone(event.userData.phone)]
    if (event.userData.externalId) userData.external_id = [event.userData.externalId]
    if (event.userData.clickId) userData.fbc = event.userData.clickId
    if (event.userData.browserId) userData.fbp = event.userData.browserId
    return userData
}

type MetaAdsSendConversionsOutput = ToolOutputByName["meta_ads_send_conversions"]
