import Stripe from "stripe"

import { PlanKey, SupportedTopUps, TimePeriods, getPlanDetails, getTopUpPriceId, resolveEnvId } from "../config/plans"
import { stripe, urls } from "../config/settings"
import { db } from "../prismaClient"

export const stripeClient = new Stripe(stripe.secretKey, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true
})

export async function getOrCreateCustomer(orgId: string, email: string): Promise<string> {
    const prisma = db()
    const row = await prisma.billing_customers.findUnique({ where: { organization_id: orgId } })
    if (row?.stripe_customer_id) return row.stripe_customer_id
    const customer = await stripeClient.customers.create({ email, metadata: { org_id: orgId } })
    await prisma.billing_customers.upsert({
        where: { organization_id: orgId },
        create: { organization_id: orgId, stripe_customer_id: customer.id },
        update: { stripe_customer_id: customer.id }
    })
    return customer.id
}

// Checkout Sessions are for purchasing something new
export async function createCheckoutSessionForPlan(orgId: string, email: string, planKey: PlanKey, timePeriod: TimePeriods): Promise<Stripe.Checkout.Session> {
    const plan = getPlanDetails(planKey)
    const basePair = timePeriod === TimePeriods.MONTHLY ? plan.monthlyBasePriceId : plan.annualBasePriceId
    if (!basePair) throw new Error(`Plan ${planKey} is not subscribable for period ${timePeriod}`)

    const basePriceId = resolveEnvId(basePair)
    const overagePriceId = resolveEnvId(plan.overagePriceId)
    const customerId = await getOrCreateCustomer(orgId, email)

    return stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: basePriceId, quantity: 1 }, ...(overagePriceId ? [{ price: overagePriceId }] : [])],
        success_url: `${urls.frontend}/billing?upgraded=1`,
        cancel_url: `${urls.frontend}/billing`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        automatic_tax: { enabled: true },
        metadata: { org_id: orgId, plan_key: planKey }
    })
}

export async function createCheckoutSessionForTopup(orgId: string, email: string, packCredits: SupportedTopUps): Promise<Stripe.Checkout.Session> {
    const customerId = await getOrCreateCustomer(orgId, email)
    const topupPriceId = getTopUpPriceId(packCredits)

    return stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [{ price: topupPriceId, quantity: 1 }],
        success_url: `${urls.frontend}/billing?topup=1`,
        cancel_url: `${urls.frontend}/billing`,
        billing_address_collection: "auto",
        automatic_tax: { enabled: true },
        metadata: { type: "credit_topup", credits: packCredits.toString(), org_id: orgId }
    })
}

// Portal Sessions are for managing existing products
export async function createPortalSession(orgId: string, email: string): Promise<Stripe.BillingPortal.Session> {
    const customerId = await getOrCreateCustomer(orgId, email)
    return stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${urls.frontend}/billing`
    })
}

// Used only by webhook handlers for automated grants:
//   - customer.subscription.created → grant the plan's monthly allowance
//   - invoice.paid (renewal)         → grant the next period's allowance
//   - checkout.session.completed (topup) → grant the purchased pack
// Comp / promo grants are done manually in Stripe Dashboard (Customer → Credits → Grant credit),
// so we deliberately do NOT expose expire / void wrappers here.
export async function createCreditGrant(input: CreateCreditGrantInput): Promise<Stripe.Billing.CreditGrant> {
    const { customerId, credits, overageCentsPerCredit, category, name, expiresAt, priority, metadata } = input
    // Stripe monetary value is in cents. Grant value = credits x metered overage rate.
    const valueInCents = Math.round(credits * overageCentsPerCredit)
    return stripeClient.billing.creditGrants.create({
        customer: customerId,
        amount: {
            type: "monetary",
            monetary: {
                value: valueInCents,
                currency: "usd"
            }
        },
        category: category,
        name: name,
        expires_at: expiresAt ? Math.floor(expiresAt.getTime() / 1000) : undefined,
        priority: priority,
        applicability_config: {
            scope: {
                price_type: "metered"
            }
        },
        metadata
    })
}

export async function fetchSubscription(customerId: string): Promise<Stripe.Subscription | null> {
    const subscriptions = await stripeClient.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10
    })
    return subscriptions.data.find(sub => sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") ?? null
}

export async function fetchCreditBalanceSummary(customerId: string, filter: Stripe.Billing.CreditBalanceSummaryRetrieveParams["filter"]): Promise<Stripe.Billing.CreditBalanceSummary> {
    // Try different possible endpoint structures
    const billingSummary = await stripeClient.billing.creditBalanceSummaries.retrieve({
        customer: customerId,
        filter
    })
    return billingSummary
}

export async function listInvoices(customerId: string, limit = 20): Promise<Stripe.Invoice[]> {
    const invoices = await stripeClient.invoices.list({ customer: customerId, limit })
    return invoices.data
}

export async function listMeterEventSummaries(opts: ListMeterEventSummariesInput): Promise<Stripe.Billing.MeterEventSummary[]> {
    const { meterId, customerId, start, end, valueGroupingWindow } = opts
    const summaries = await stripeClient.billing.meters.listEventSummaries(
        meterId, // meter ID or event name
        {
            customer: customerId,
            start_time: Math.floor(start.getTime() / 1000), // Convert to Unix timestamp
            end_time: Math.floor(end.getTime() / 1000), // Convert to Unix timestamp
            value_grouping_window: valueGroupingWindow
        }
    )
    return summaries.data
}

export async function postMeterEvent(input: PostMeterEventInput): Promise<void> {
    const { eventName, customerId, value, identifier, timestamp } = input

    await stripeClient.billing.meterEvents.create({
        event_name: eventName,
        identifier,
        timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
        payload: {
            stripe_customer_id: customerId,
            value: value.toString() // Stripe expects string here
        }
    })
}

export type CreateCreditGrantInput = {
    customerId: string
    credits: number
    overageCentsPerCredit: number
    category: "promotional" | "paid"
    name: string
    expiresAt: Date | null // null for top-ups; period_end for plan grants
    priority: number // Lower drains first e.g. : plan=50, topup=75, promo=0 === promo -> plan -> top-up
    metadata?: Record<string, string>
}

export type ListMeterEventSummariesInput = {
    meterId: string
    customerId: string
    start: Date // Inclusive lower bound
    end: Date // Exclusive upper bound
    valueGroupingWindow: "hour" | "day" // Bucket size; "day" for the usage chart
}

export type PostMeterEventInput = {
    eventName: "credit_consumption"
    customerId: string
    value: number
    identifier: string
    timestamp?: Date
}
