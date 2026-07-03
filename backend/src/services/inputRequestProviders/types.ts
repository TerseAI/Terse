import { SdkInputRequestDelivery, SdkInputRequestRegisterBody } from "terse-types/types"

export type InputRequestDeliverParams = { organizationId: string; jobName: string; body: SdkInputRequestRegisterBody }
export type InputRequestDeliverResult = { ok: true; delivery: SdkInputRequestDelivery } | { ok: false; error: string }

// Outbound half of an input provider: deliver the request to humans.
// The inbound half is the provider's own webhook layer translating its native response
// event into InputRequestService.resolveInputRequest(token, response).
export interface InputRequestProvider {
    readonly provider: SdkInputRequestDelivery["provider"]
    deliver(params: InputRequestDeliverParams): Promise<InputRequestDeliverResult>
}
