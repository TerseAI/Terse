import { deliverSlackInputRequest } from "../../integrations/slack/inputRequests"

import { InputRequestDeliverParams, InputRequestDeliverResult, InputRequestProvider } from "./types"

export class SlackInputRequestProvider implements InputRequestProvider {
    readonly provider = "slack" as const

    async deliver({ organizationId, jobName, body }: InputRequestDeliverParams): Promise<InputRequestDeliverResult> {
        if (body.via.provider !== "slack") return { ok: false, error: "Target is not a Slack destination." }
        const result = await deliverSlackInputRequest({ organizationId, jobName, body })
        if (!result.ok) return result
        return { ok: true, delivery: { provider: "slack", channelId: result.channelId, messageTs: result.messageTs } }
    }
}
