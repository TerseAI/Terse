import express from "express"
import { DateTime } from "luxon"
import type { BalanceSummary, BillingStripeRedirectResponse, SetOverageModeResponse, UsageResponse } from "terse-types"
import { z } from "zod"

import { PlanKey, SupportedTopUps, TimePeriods, getCreditConsumptionMeterId } from "../config/plans"
import { db } from "../prismaClient"
import { creditService } from "../services/CreditService"
import { createCheckoutSessionForPlan, createCheckoutSessionForTopup, createPortalSession, listMeterEventSummaries } from "../services/PaymentsProviderService"
import { Session } from "../types/session"

export const billingRouter = express.Router()

const checkoutBodySchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("plan"), planKey: z.enum(PlanKey), period: z.enum(TimePeriods) }),
    z.object({ kind: z.literal("topup"), packCredits: z.enum(SupportedTopUps) })
])

billingRouter.post("/checkout-session", async (req, res) => {
    const session = req.session as Session
    const orgId = session.user.organizationId
    const email = session.user.email

    const parsed = checkoutBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

    const stripeSession =
        parsed.data.kind === "plan"
            ? await createCheckoutSessionForPlan(orgId, email, parsed.data.planKey, parsed.data.period)
            : await createCheckoutSessionForTopup(orgId, email, parsed.data.packCredits)

    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a checkout URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
})

billingRouter.post("/portal-session", async (req, res) => {
    const session = req.session as Session
    const stripeSession = await createPortalSession(session.user.organizationId, session.user.email)
    if (!stripeSession.url) {
        return res.status(500).json({ error: "Stripe did not return a portal URL" })
    }
    const body: BillingStripeRedirectResponse = { url: stripeSession.url }
    return res.json(body)
})

billingRouter.get("/balance", async (req, res) => {
    const session = req.session as Session
    const summary = await creditService.getBalanceSummary(session.user.organizationId)
    return res.json(summary)
})

billingRouter.get("/usage", async (req, res) => {
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
})

billingRouter.patch("/overage-mode", async (req, res) => {
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
    const body: SetOverageModeResponse = { ok: true }
    return res.json(body)
})
