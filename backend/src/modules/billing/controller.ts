import { Request, Response } from "express"
import { billingChangeRequestBodySchema, billingCheckoutRequestBodySchema, billingContextQuerySchema, billingPortalSessionRequestBodySchema, billingUsageBucketsQuerySchema } from "terse-types"

import { AnalyticsEvent, analytics } from "../../common/analytics"

import { BillingServiceProxy, billingForRequest } from "./service"

export async function createBillingCheckoutSession(req: Request, res: Response) {
    const body = billingCheckoutRequestBodySchema.parse(req.body)
    const billingService = billingForRequest(req)
    const user = req.session?.user
    if (user) analytics.capture(user.id, AnalyticsEvent.BILLING_CHECKOUT_STARTED, { organizationId: user.organizationId })
    await BillingServiceProxy.respondJson(res, billingService.createCheckoutSession(body))
}

export async function createBillingPortalSession(req: Request, res: Response) {
    const body = billingPortalSessionRequestBodySchema.parse(req.body ?? {})
    const billingService = billingForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.createBillingPortalSession(body))
}

export async function changeBillingSubscription(req: Request, res: Response) {
    const body = billingChangeRequestBodySchema.parse(req.body)
    const billingService = billingForRequest(req)
    const user = req.session?.user
    if (user) analytics.capture(user.id, AnalyticsEvent.BILLING_SUBSCRIPTION_CHANGE_REQUESTED, { organizationId: user.organizationId })
    await BillingServiceProxy.respondJson(res, billingService.changeBillingSubscription(body))
}

export async function getBillingCatalog(req: Request, res: Response) {
    const billingService = billingForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingCatalog())
}

export async function getBillingStatus(req: Request, res: Response) {
    const billingService = billingForRequest(req)
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
    const billingService = billingForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingContext(parsed.data))
}

export async function getBillingUsageBuckets(req: Request, res: Response) {
    const parsed = billingUsageBucketsQuerySchema.safeParse({
        start: req.query.start,
        end: req.query.end,
        timezone: req.query.timezone
    })
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message })
    }
    const billingService = billingForRequest(req)
    await BillingServiceProxy.respondJson(res, billingService.getBillingUsageBuckets(parsed.data))
}
