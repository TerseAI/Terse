import { Request, Response } from "express"
import { DateTime } from "luxon"
import type { BillingCatalogResponse, BillingChangeResponse, BillingStripeRedirectResponse, SetOverageModeResponse, UsageResponse } from "terse-types"
import { isPurchasablePlan } from "terse-types"
import { z } from "zod"

import { PlanKey, SupportedTopUps, TimePeriods, getAllPlans, getAllTopups, getCreditConsumptionMeterId, getPlanDetails } from "../config/plans"
import { db } from "../prismaClient"
import { emitBillingCachesInvalidated } from "../services/CacheInvalidationService"
import { creditService } from "../services/CreditService"
import {
    createCheckoutSessionForPlan,
    createCheckoutSessionForTopup,
    createPortalSession,
    fetchActivePaidSubscription,
    getOrCreateCustomer,
    listMeterEventSummaries,
    scheduleBillingPeriodChange,
    scheduleCancelToFree
} from "../services/PaymentsProviderService"
import { Session } from "../types/session"

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
    const email = session.user.email

    const parsed = checkoutBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    if (parsed.data.kind === "plan" && !isPurchasablePlan(getPlanDetails(parsed.data.planKey))) {
        return res.status(400).json({
            error: "Free plan cannot be purchased; cancel a paid subscription in the billing portal to return to Free."
        })
    }
    const customer = await db().billing_customers.findUnique({ where: { organization_id: orgId } })
    const activeSubscription = customer?.stripe_customer_id ? await fetchActivePaidSubscription(customer.stripe_customer_id) : null
    if (parsed.data.kind === "plan" && activeSubscription) {
        return res.status(409).json({ error: "Use the billing change endpoint for existing subscriptions." })
    }

    const stripeSession =
        parsed.data.kind === "plan"
            ? await createCheckoutSessionForPlan(orgId, email, parsed.data.planKey, parsed.data.period)
            : await createCheckoutSessionForTopup(orgId, email, parsed.data.packCredits)

    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a checkout URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
}

export async function createBillingPortalSession(req: Request, res: Response) {
    const session = req.session as Session
    const stripeSession = await createPortalSession(session.user.organizationId, session.user.email)
    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a portal URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
}

export async function changeBillingSubscription(req: Request, res: Response) {
    const session = req.session as Session
    const orgId = session.user.organizationId
    const email = session.user.email
    const parsed = changeBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    const result = parsed.data.kind === "cancel_to_free" ? await scheduleCancelToFree(orgId, email) : await scheduleBillingPeriodChange(orgId, email, parsed.data.planKey, parsed.data.period)

    const body: BillingChangeResponse = { ok: true, scheduledChange: result.scheduledChange }
    return res.json(body)
}

export async function getBillingCatalog(_req: Request, res: Response) {
    const body: BillingCatalogResponse = { plans: getAllPlans(), topUps: getAllTopups() }
    return res.json(body)
}

export async function getBillingBalance(req: Request, res: Response) {
    const session = req.session as Session
    await getOrCreateCustomer(session.user.organizationId, session.user.email)
    const summary = await creditService.getBalanceSummary(session.user.organizationId)
    return res.json(summary)
}

export async function getBillingUsage(req: Request, res: Response) {
    const session = req.session as Session
    const orgId = session.user.organizationId
    const customer = await db().billing_customers.findUnique({ where: { organization_id: orgId } })

    if (!customer?.stripe_customer_id) {
        const empty: UsageResponse = { buckets: [] }
        return res.json(empty)
    }

    const end = req.query.end ? new Date(String(req.query.end)) : new Date()
    const start = req.query.start ? new Date(String(req.query.start)) : DateTime.fromJSDate(end).minus({ days: 30 }).toJSDate()

    const summaries = await listMeterEventSummaries({
        meterId: getCreditConsumptionMeterId(),
        customerId: customer.stripe_customer_id,
        start,
        end,
        valueGroupingWindow: "day"
    })

    const body: UsageResponse = {
        buckets: summaries.map(summary => ({
            startTimestamp: summary.start_time * 1000,
            endTimestamp: summary.end_time * 1000,
            credits: Number(summary.aggregated_value)
        }))
    }
    return res.json(body)
}

export async function setBillingOverageMode(req: Request, res: Response) {
    const session = req.session as Session
    const parsed = z.object({ mode: z.enum(["soft", "strict"]) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    await db().billing_customers.upsert({
        where: { organization_id: session.user.organizationId },
        create: {
            organization_id: session.user.organizationId,
            overage_mode: parsed.data.mode
        },
        update: { overage_mode: parsed.data.mode }
    })
    emitBillingCachesInvalidated(session.user.organizationId)
    const body: SetOverageModeResponse = { ok: true }
    return res.json(body)
}
