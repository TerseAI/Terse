import { Request, Response } from "express"
import { billingChangeRequestBodySchema, billingCheckoutRequestBodySchema, billingContextQuerySchema, billingOverageModePatchBodySchema, billingPortalSessionRequestBodySchema } from "terse-types"

import { BillingServiceProxy, billingServiceProxyForRequest } from "../services/BillingService"

export async function createBillingCheckoutSession(req: Request, res: Response) {
    const body = billingCheckoutRequestBodySchema.parse(req.body)
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.createCheckoutSession(body))
}

export async function createBillingPortalSession(req: Request, res: Response) {
    const body = billingPortalSessionRequestBodySchema.parse(req.body ?? {})
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.createBillingPortalSession(body))
}

export async function changeBillingSubscription(req: Request, res: Response) {
    const body = billingChangeRequestBodySchema.parse(req.body)
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.changeBillingSubscription(body))
}

export async function getBillingCatalog(req: Request, res: Response) {
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingCatalog())
}

export async function getBillingContext(req: Request, res: Response) {
    const query = billingContextQuerySchema.parse({
        start: typeof req.query.start === "string" ? req.query.start : undefined,
        end: typeof req.query.end === "string" ? req.query.end : undefined
    })
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingContext(query))
}

export async function setBillingOverageMode(req: Request, res: Response) {
    const body = billingOverageModePatchBodySchema.parse(req.body)
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.setBillingOverageMode(body))
}
