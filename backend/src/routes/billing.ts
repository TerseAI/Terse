import { Request, Response } from "express"
import { DateTime } from "luxon"
import type { BillingCatalogResponse, BillingChangeResponse, BillingContextResponse, BillingStripeRedirectResponse, SetOverageModeResponse } from "terse-types"
import { isPurchasablePlan } from "terse-types"
import { z } from "zod"

import { PlanKey, SupportedTopUps, TimePeriods, getAllPlans, getAllTopups, getPlanDetails } from "../config/plans"
import { emitBillingCachesInvalidated } from "../services/CacheInvalidationService"
import { creditService } from "../services/CreditService"
import {
    createCheckoutSessionForPlan,
    createCheckoutSessionForTopup,
    createPortalSession,
    fetchActivePaidSubscription,
    getOrCreateCustomer,
    scheduleBillingPeriodChange,
    scheduleCancelToFree
} from "../services/PaymentsProviderService"
import { Session } from "../types/session"

import { updateOrganizationMetadata } from "./auth"

const checkoutBodySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("plan"), planKey: z.enum(PlanKey), period: z.enum(TimePeriods) }),
    z.object({ kind: z.literal("topup"), packCredits: z.enum(SupportedTopUps) })
])

const changeBodySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("cancel_to_free") }),
    z.object({ kind: z.literal("change_period"), planKey: z.enum(PlanKey), period: z.enum(TimePeriods) })
])

export async function createBillingCheckoutSession(req: Request, res: Response) {
    const session = req.session as Session
    const orgId = session.user.organizationId

    const parsed = checkoutBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    if (parsed.data.kind === "plan" && !isPurchasablePlan(getPlanDetails(parsed.data.planKey))) {
        return res.status(400).json({
            error: "Free plan cannot be purchased; cancel a paid subscription in the billing portal to return to Free."
        })
    }
    const stripeCustomerId = await getOrCreateCustomer(orgId)
    const activeSubscription = stripeCustomerId ? await fetchActivePaidSubscription(stripeCustomerId) : null
    if (parsed.data.kind === "plan" && activeSubscription) {
        return res.status(409).json({ error: "Use the billing change endpoint for existing subscriptions." })
    }

    const stripeSession =
        parsed.data.kind === "plan" ? await createCheckoutSessionForPlan(orgId, parsed.data.planKey, parsed.data.period) : await createCheckoutSessionForTopup(orgId, parsed.data.packCredits)

    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a checkout URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
}

export async function createBillingPortalSession(req: Request, res: Response) {
    const session = req.session as Session
    const stripeSession = await createPortalSession(session.user.organizationId)
    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a portal URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
}

export async function changeBillingSubscription(req: Request, res: Response) {
    const session = req.session as Session
    const orgId = session.user.organizationId
    const parsed = changeBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    const result = parsed.data.kind === "cancel_to_free" ? await scheduleCancelToFree(orgId) : await scheduleBillingPeriodChange(orgId, parsed.data.planKey, parsed.data.period)

    const body: BillingChangeResponse = { ok: true, scheduledChange: result.scheduledChange }
    return res.json(body)
}

export async function getBillingCatalog(_req: Request, res: Response) {
    const body: BillingCatalogResponse = { plans: getAllPlans(), topUps: getAllTopups() }
    return res.json(body)
}

export async function getBillingContext(req: Request, res: Response) {
    const session = req.session as Session
    const orgId = session.user.organizationId

    const end = req.query.end ? new Date(String(req.query.end)) : new Date()
    const start = req.query.start ? new Date(String(req.query.start)) : DateTime.fromJSDate(end).minus({ days: 30 }).toJSDate()

    const body: BillingContextResponse = await creditService.getBillingContext(orgId, { start, end })
    return res.json(body)
}

export async function setBillingOverageMode(req: Request, res: Response) {
    const session = req.session as Session
    const parsed = z.object({ mode: z.enum(["soft", "strict"]) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    const orgId = session.user.organizationId
    await updateOrganizationMetadata(orgId, { overageMode: parsed.data.mode })
    emitBillingCachesInvalidated(session.user.organizationId)
    const body: SetOverageModeResponse = { ok: true }
    return res.json(body)
}
