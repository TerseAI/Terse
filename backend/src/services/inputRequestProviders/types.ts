import { SdkInputRequestDelivery, SdkInputRequestRegisterBody } from "terse-types/types"

export type InputRequestDeliverResult = { ok: true; delivery: SdkInputRequestDelivery } | { ok: false; error: string }

// Outbound half of an input provider: deliver the request to humans, expire it on timeout.
// The inbound half is the provider's own webhook layer translating its native response
// event into InputRequestService.resolveInputRequest(token, response).
export interface InputRequestProvider {
    readonly provider: SdkInputRequestDelivery["provider"]
    deliver(params: { organizationId: string; jobName: string; body: SdkInputRequestRegisterBody }): Promise<InputRequestDeliverResult>
    expire(params: { organizationId: string; delivery: SdkInputRequestDelivery }): Promise<{ ok: boolean; error?: string }>
}
