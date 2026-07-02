import { deliverSlackInputRequest, finalizeSlackInputRequestMessage, getSlackBotClientForOrganization } from "../../integrations/slack/inputRequests"

import { InputRequestProvider } from "./types"

export const slackInputRequestProvider: InputRequestProvider = {
    provider: "slack",

    async deliver({ organizationId, jobName, body }) {
        if (body.via.provider !== "slack") return { ok: false, error: "Target is not a Slack destination." }
        const result = await deliverSlackInputRequest({ organizationId, jobName, body })
        if (!result.ok) return result
        return { ok: true, delivery: { provider: "slack", channelId: result.channelId, messageTs: result.messageTs } }
    },

    async expire({ organizationId, delivery }) {
        if (delivery.provider !== "slack") return { ok: false, error: "Delivery is not a Slack message." }
        const client = await getSlackBotClientForOrganization(organizationId)
        if (!client) return { ok: false, error: "No Slack integration is connected for this organization." }
        const updated = await finalizeSlackInputRequestMessage(client, delivery.channelId, delivery.messageTs, ":hourglass: Timed out waiting for a response.")
        return { ok: updated, error: updated ? undefined : "Failed to update the Slack message." }
    }
}
