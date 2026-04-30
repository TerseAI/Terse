import { Request, Response } from "express"
import type Stripe from "stripe"

import { PlanKey, getPlanByPriceId, getPlanDetails, resolveEnvId } from "../config/plans"
import { stripe as stripeSettings } from "../config/settings"
import logger from "../logger"
import { emitBillingCachesInvalidated } from "../services/CacheInvalidationService"
import {
    StripeCustomerMetadata,
    createCreditGrant,
    getStripeCustomerWithMetadata,
    resolveSubscriptionBasePlanItem,
    resolveSubscriptionCreditPeriod,
    stripeClient
} from "../services/PaymentsProviderService"

export async function handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers["stripe-signature"] as string
    let event: Stripe.Event

    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, stripeSettings.webhookSecret)
    } catch (err) {
        logger.warn("Stripe webhook signature failure", { error: err })
        return res.status(400).send(`Webhook Error: ${(err as Error).message}`)
    }

    try {
        await dispatch(event)
        return res.json({ received: true })
    } catch (err) {
        logger.error("Stripe webhook handler failure", { eventId: event.id, eventType: event.type, error: err })
        return res.status(500).json({ error: "Stripe webhook handler failed" })
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
        case "billing.credit_grant.created":
        case "billing.credit_grant.updated":
            return onCreditGrantChanged(event.data.object as Stripe.Billing.CreditGrant)
        case "billing.credit_balance_transaction.created":
            return onCreditBalanceTransactionCreated(event.data.object as Stripe.Billing.CreditBalanceTransaction)
        default:
            logger.debug("Unhandled stripe event", { type: event.type })
    }
}

async function onSubscriptionUpsert(subscription: Stripe.Subscription) {
    const orgId = await orgIdForCustomer(subscription.customer as string)
    if (!orgId) {
        logger.warn("Subscription with no org mapping", { subscriptionId: subscription.id })
        return
    }

    const planItem = resolveSubscriptionBasePlanItem(subscription)
    if (!planItem) {
        logger.warn("Subscription with no Terse base plan item", { subscriptionId: subscription.id })
        return
    }

    const creditPeriod = resolveSubscriptionCreditPeriod(subscription, planItem.item)
    if (!creditPeriod) {
        logger.warn("Subscription has no monthly credit period item yet", { subscriptionId: subscription.id, basePriceId: planItem.item.price.id })
        return
    }

    const periodStart = creditPeriod.start
    const periodEnd = creditPeriod.end

    const priceId = planItem.item.price.id
    const plan = planItem.plan.details
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
            period_start: periodStart.toISOString(),
            credit_period_item_id: creditPeriod.item.id
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
async function ensureSubscriptionHasMeteredOverage(session: Stripe.Checkout.Session): Promise<Stripe.Subscription | null> {
    const subscriptionId = session.subscription
    const planKeyRaw = session.metadata?.plan_key
    if (typeof subscriptionId !== "string" || !planKeyRaw || !(Object.values(PlanKey) as string[]).includes(planKeyRaw)) return null

    const plan = getPlanDetails(planKeyRaw as PlanKey)
    const overagePriceId = resolveEnvId(plan.overagePriceId)
    if (!overagePriceId) return null

    const sub = await stripeClient.subscriptions.retrieve(subscriptionId)
    const hasOverage = sub.items.data.some(item => item.price.id === overagePriceId)
    if (hasOverage) return sub

    return stripeClient.subscriptions.update(subscriptionId, {
        items: [{ price: overagePriceId }]
    })
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === "subscription" && typeof session.subscription === "string" && session.metadata?.plan_key) {
        const subscription = await ensureSubscriptionHasMeteredOverage(session)
        if (subscription) {
            await onSubscriptionUpsert(subscription)
        }
    }

    if (session.metadata?.type !== "credit_topup") return

    const orgId = await orgIdForCustomer(session.customer as string)
    const credits = Number(session.metadata.credits)
    const customerId = session.customer as string | null
    if (!orgId || !credits || !customerId) {
        logger.warn("Top-up checkout missing metadata", { sessionId: session.id })
        return
    }

    const subscriptions = await stripeClient.subscriptions.list({ customer: customerId, status: "active", limit: 10 })
    const planItem = subscriptions.data.map(resolveSubscriptionBasePlanItem).find((item): item is NonNullable<ReturnType<typeof resolveSubscriptionBasePlanItem>> => !!item)
    const priceId = planItem?.item.price.id
    const plan = priceId ? getPlanByPriceId(priceId) : getPlanDetails(PlanKey.FREE)
    const centsPerCredit = creditGrantCentsPerCredit(plan)
    if (!centsPerCredit) {
        logger.warn("Top-up purchased but no credit grant conversion rate is configured", { orgId })
        return
    }

    await createCreditGrant({
        customerId,
        credits,
        overageCentsPerCredit: centsPerCredit,
        category: "paid",
        name: `Top-up: ${credits.toLocaleString()} credits`,
        expiresAt: null,
        priority: 75,
        metadata: { org_id: orgId, type: "topup", session_id: session.id },
        idempotencyKey: `topup-grant:${session.id}`
    })
}

async function onCreditGrantChanged(creditGrant: Stripe.Billing.CreditGrant) {
    await invalidateBillingForStripeCustomer(customerIdFromCreditGrant(creditGrant), "credit grant", creditGrant.id)
}

async function onCreditBalanceTransactionCreated(transaction: Stripe.Billing.CreditBalanceTransaction) {
    await invalidateBillingForStripeCustomer(await customerIdForCreditBalanceTransaction(transaction), "credit balance transaction", transaction.id)
}

async function invalidateBillingForStripeCustomer(customerId: string | null, source: string, sourceId: string) {
    if (!customerId) {
        logger.warn(`Stripe ${source} missing customer`, { sourceId })
        return
    }

    const orgId = await orgIdForCustomer(customerId)
    if (!orgId) {
        logger.warn(`Stripe ${source} with no org mapping`, { customerId, sourceId })
        return
    }

    emitBillingCachesInvalidated(orgId)
}

async function customerIdForCreditBalanceTransaction(transaction: Stripe.Billing.CreditBalanceTransaction): Promise<string | null> {
    if (typeof transaction.credit_grant !== "string") {
        return customerIdFromCreditGrant(transaction.credit_grant)
    }

    const creditGrant = await stripeClient.billing.creditGrants.retrieve(transaction.credit_grant)
    return customerIdFromCreditGrant(creditGrant)
}

function customerIdFromCreditGrant(creditGrant: Stripe.Billing.CreditGrant): string | null {
    if (typeof creditGrant.customer === "string") return creditGrant.customer
    return creditGrant.customer?.id ?? null
}

function creditGrantCentsPerCredit(plan: ReturnType<typeof getPlanDetails>): number | null {
    return plan.overageCentsPerCredit ?? getPlanDetails(PlanKey.PRO).overageCentsPerCredit
}

async function orgIdForCustomer(customerId: string): Promise<string | null> {
    const customer = await getStripeCustomerWithMetadata(customerId)
    if (!customer) {
        logger.warn("Stripe customer not found", { customerId })
        return null
    }
    return customer.metadata.organizationId
}
