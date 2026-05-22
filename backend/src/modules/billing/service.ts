import { Request } from "express"

import { BillingServiceProxy, billingServiceProxyForRequest } from "../../services/BillingService"

// Service layer for billing. The actual billing logic lives in BillingServiceProxy
// (which proxies to an external billing service). This thin wrapper centralizes
// how the proxy is constructed per-request, keeping controllers transport-focused.
export function billingForRequest(req: Request) {
    return billingServiceProxyForRequest(req)
}

export { BillingServiceProxy }
