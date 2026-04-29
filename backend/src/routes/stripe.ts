import { Request, Response } from "express"
import type Stripe from "stripe"

import { PlanKey, getPlanByPriceId, getPlanDetails, resolveEnvId } from "../config/plans"
import { stripe as stripeSettings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { createCreditGrant, stripeClient } from "../services/PaymentsProviderService"

export async function handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers["stripe-signature"] as string
    let event: Stripe.Event

    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, stripeSettings.webhookSecret)
    } catch (err) {
        logger.warn("Stripe webhook signature failure", { error: err })
        return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }

    res.json({ received: true })

    try {
        await dispatch(event)
    } catch (err) {
        logger.error("Stripe webhook handler failure", { eventId: event.id, eventType: event.type, error: err })
    }
}

async function dispatch(event: Stripe.Event) {
    switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
            return onSubscriptionUpsert(event.data.object as Stripe.Subscription)
        case "customer.subscription.deleted":
            return onSubscriptionDeleted(event.data.object as Stripe.Subscription)
        case "invoice.paid":
            return onInvoicePaid(event.data.object as Stripe.Invoice)
        case "invoice.payment_failed":
            return onInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        case "checkout.session.completed":
            return onCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        default:
            logger.debug("Unhandled stripe event", { type: event.type })
    }
}

async function onSubscriptionUpsert(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.org_id ?? (await orgIdForCustomer(subscription.customer as string))
    if (!orgId) {
        logger.warn("Subscription with no org mapping", { subscriptionId: subscription.id })
        return
    }

    const planItem = resolveBasePlanItem(subscription)
    if (!planItem) {
        logger.warn("Subscription with no Terse base plan item", { subscriptionId: subscription.id })
        return
    }

    const periodStart = subscriptionItemDate(planItem.current_period_start, "current_period_start", subscription.id, planItem.id)
    const periodEnd = subscriptionItemDate(planItem.current_period_end, "current_period_end", subscription.id, planItem.id)
    const existingPeriod = await db().billing_period_consumption.findUnique({ where: { organization_id: orgId } })
    const isNewPeriod = !existingPeriod || existingPeriod.period_start.getTime() !== periodStart.getTime() || existingPeriod.period_end.getTime() !== periodEnd.getTime()

    if (!isNewPeriod) return

    // This resets consumed_credits to 0 unconditionally. For free-to-paid upgrades,
    // that is intentional: prior free-plan consumption is forgiven when the org upgrades.
    // If product later wants to carry free consumption forward, gate this reset on
    // subscription metadata or a previous-period lookup.
    await db().billing_period_consumption.upsert({
        where: { organization_id: orgId },
        create: {
            organization_id: orgId,
            period_start: periodStart,
            period_end: periodEnd,
            consumed_credits: 0,
            notified_thresholds: []
        },
        update: {
            period_start: periodStart,
            period_end: periodEnd,
            consumed_credits: 0,
            notified_thresholds: []
        }
    })

    const priceId = planItem.price.id
    const plan = getPlanByPriceId(priceId)
    if (!plan.overageCentsPerCredit) return

    await createCreditGrant({
        customerId: subscription.customer as string,
        credits: plan.includedCreditsPerMonth,
        overageCentsPerCredit: plan.overageCentsPerCredit,
        category: "paid",
        name: `${plan.name} included credits`,
        expiresAt: periodEnd,
        priority: 50,
        metadata: {
            org_id: orgId,
            plan_price_id: priceId,
            period_start: periodStart.toISOString()
        },
        idempotencyKey: `plan-grant:${subscription.id}:${periodStart.toISOString()}`
    })
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
    logger.info("Subscription deleted", { subscriptionId: subscription.id, customer: subscription.customer })
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
    logger.info("Invoice paid", { invoiceId: invoice.id, customer: invoice.customer })
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
    logger.warn("Invoice payment failed", { invoiceId: invoice.id, customer: invoice.customer })
}

/** Plan checkouts only include the base price; metered overage is added here for every period. */
async function ensureSubscriptionHasMeteredOverage(session: Stripe.Checkout.Session) {
    const subscriptionId = session.subscription
    const planKeyRaw = session.metadata?.plan_key
    if (typeof subscriptionId !== "string" || !planKeyRaw || !(Object.values(PlanKey) as string[]).includes(planKeyRaw)) return

    const plan = getPlanDetails(planKeyRaw as PlanKey)
    const overagePriceId = resolveEnvId(plan.overagePriceId)
    if (!overagePriceId) return

    const sub = await stripeClient.subscriptions.retrieve(subscriptionId)
    const hasOverage = sub.items.data.some(item => item.price.id === overagePriceId)
    if (hasOverage) return

    await stripeClient.subscriptions.update(subscriptionId, {
        items: [{ price: overagePriceId }]
    })
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === "subscription" && typeof session.subscription === "string" && session.metadata?.plan_key) {
        await ensureSubscriptionHasMeteredOverage(session)
    }

    if (session.metadata?.type !== "credit_topup") return

    const orgId = session.metadata.org_id
    const credits = Number(session.metadata.credits)
    const customerId = session.customer as string | null
    if (!orgId || !credits || !customerId) {
        logger.warn("Top-up checkout missing metadata", { sessionId: session.id })
        return
    }

    const subscriptions = await stripeClient.subscriptions.list({ customer: customerId, status: "active", limit: 10 })
    const planItem = subscriptions.data.map(resolveBasePlanItem).find((item): item is Stripe.SubscriptionItem => !!item)
    const priceId = planItem?.price.id
    const plan = priceId ? getPlanByPriceId(priceId) : null
    if (!plan?.overageCentsPerCredit) {
        logger.warn("Top-up purchased on plan with no overage rate", { orgId })
        return
    }

    await createCreditGrant({
        customerId,
        credits,
        overageCentsPerCredit: plan.overageCentsPerCredit,
        category: "paid",
        name: `Top-up: ${credits.toLocaleString()} credits`,
        expiresAt: null,
        priority: 75,
        metadata: { org_id: orgId, type: "topup", session_id: session.id },
        idempotencyKey: `topup-grant:${session.id}`
    })
}

async function orgIdForCustomer(customerId: string): Promise<string | null> {
    const row = await db().billing_customers.findUnique({ where: { stripe_customer_id: customerId } })
    return row?.organization_id ?? null
}

function resolveBasePlanItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | null {
    for (const item of subscription.items.data) {
        try {
            const plan = getPlanByPriceId(item.price.id)
            if (priceMatches(plan.monthlyBasePriceId, item.price.id) || priceMatches(plan.annualBasePriceId, item.price.id)) {
                return item
            }
        } catch {
            continue
        }
    }
    return null
}

function priceMatches(pair: { live: string; test: string } | null, priceId: string): boolean {
    return !!pair && (pair.live === priceId || pair.test === priceId)
}

function subscriptionItemDate(value: number, field: "current_period_start" | "current_period_end", subscriptionId: string, itemId: string): Date {
    if (!Number.isFinite(value)) {
        throw new Error(`Subscription ${subscriptionId} plan item ${itemId} has invalid ${field}`)
    }
    const date = new Date(value * 1000)
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Subscription ${subscriptionId} plan item ${itemId} has invalid ${field}`)
    }
    return date
}
