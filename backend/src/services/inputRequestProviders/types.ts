import { SdkInputRequestDelivery, SdkInputRequestRegisterBody } from "terse-types/types"

export type InputRequestDeliverParams = { organizationId: string; jobName: string; body: SdkInputRequestRegisterBody }
export type InputRequestDeliverResult = { ok: true; delivery: SdkInputRequestDelivery } | { ok: false; error: string }

export type InputRequestExpireParams = { organizationId: string; delivery: SdkInputRequestDelivery }
export type InputRequestExpireResult = { ok: boolean; error?: string }

// Outbound half of an input provider: deliver the request to humans, expire it on timeout.
// The inbound half is the provider's own webhook layer translating its native response
// event into InputRequestService.resolveInputRequest(token, response).
export interface InputRequestProvider {
    readonly provider: SdkInputRequestDelivery["provider"]
    deliver(params: InputRequestDeliverParams): Promise<InputRequestDeliverResult>
    expire(params: InputRequestExpireParams): Promise<InputRequestExpireResult>
}
