import { Request, Response } from "express"
import { billingChangeRequestBodySchema, billingCheckoutRequestBodySchema, billingContextQuerySchema, billingOverageModePatchBodySchema, billingPortalSessionRequestBodySchema } from "terse-types"

import { settings } from "../config/settings"
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
    const parsed = billingContextQuerySchema.safeParse({
        start: typeof req.query.start === "string" ? req.query.start : undefined,
        end: typeof req.query.end === "string" ? req.query.end : undefined
    })
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message })
    }
    const billingService = billingServiceProxyForRequest(req)
    const withAvailability = billingService.getBillingContext(parsed.data)
    await BillingServiceProxy.respondJson(res, withAvailability)
}

export async function setBillingOverageMode(req: Request, res: Response) {
    const body = billingOverageModePatchBodySchema.parse(req.body)
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.setBillingOverageMode(body))
}
