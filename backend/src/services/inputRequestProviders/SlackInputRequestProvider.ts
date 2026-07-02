import { deliverSlackInputRequest, finalizeSlackInputRequestMessage, getSlackBotClientForOrganization } from "../../integrations/slack/inputRequests"

import { InputRequestDeliverParams, InputRequestDeliverResult, InputRequestExpireParams, InputRequestExpireResult, InputRequestProvider } from "./types"

export class SlackInputRequestProvider implements InputRequestProvider {
    readonly provider = "slack" as const

    async deliver({ organizationId, jobName, body }: InputRequestDeliverParams): Promise<InputRequestDeliverResult> {
        if (body.via.provider !== "slack") return { ok: false, error: "Target is not a Slack destination." }
        const result = await deliverSlackInputRequest({ organizationId, jobName, body })
        if (!result.ok) return result
        return { ok: true, delivery: { provider: "slack", channelId: result.channelId, messageTs: result.messageTs } }
    }

    async expire({ organizationId, delivery }: InputRequestExpireParams): Promise<InputRequestExpireResult> {
        if (delivery.provider !== "slack") return { ok: false, error: "Delivery is not a Slack message." }
        const client = await getSlackBotClientForOrganization(organizationId)
        if (!client) return { ok: false, error: "No Slack integration is connected for this organization." }
        const updated = await finalizeSlackInputRequestMessage(client, delivery.channelId, delivery.messageTs, ":hourglass: Timed out waiting for a response.")
        return { ok: updated, error: updated ? undefined : "Failed to update the Slack message." }
    }
}
