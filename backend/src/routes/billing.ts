import { Request, Response } from "express"
import { billingChangeRequestBodySchema, billingCheckoutRequestBodySchema, billingContextQuerySchema, billingPortalSessionRequestBodySchema } from "terse-types"

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

export async function getBillingStatus(req: Request, res: Response) {
    const billingService = billingServiceProxyForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingStatus())
}

export async function getBillingContext(req: Request, res: Response) {
    const parsed = billingContextQuerySchema.safeParse({
        start: req.query.start,
        end: req.query.end,
        timezone: req.query.timezone
    })
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message })
    }
    const billingService = billingServiceProxyForRequest(req)
    const withAvailability = billingService.getBillingContext(parsed.data)
    await BillingServiceProxy.respondJson(res, withAvailability)
}
