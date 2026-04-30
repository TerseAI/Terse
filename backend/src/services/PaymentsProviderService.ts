import { DateTime } from "luxon"
import Stripe from "stripe"
import { type BillingPeriod, FrontendRoutes, isPurchasablePlan } from "terse-types"
import { z } from "zod"

import { PlanKey, SupportedTopUps, TimePeriods, getPlanByPriceId, getPlanDetails, getTopUpPriceId, resolveEnvId } from "../config/plans"
import { stripe, urls } from "../config/settings"
import logger from "../logger"
import { getOrganization, resolveWorkOSAdminUser, setDefaultOrganizationMetadata } from "../routes/auth"

export const stripeClient = new Stripe(stripe.secretKey, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true
})

export async function getOrCreateCustomer(orgId: string): Promise<string> {
    const organization = await getOrganization(orgId)
    const stripeCustomerId = organization.metadata.stripeCustomerId
    if (stripeCustomerId) return stripeCustomerId
    logger.info("No Stripe customer found for organization, creating one", { orgId })
    const adminUser = await resolveWorkOSAdminUser(orgId)
    const metadata = stripeCustomerMetadataSchema.parse({ organizationId: orgId })
    const customer = await stripeClient.customers.create({ email: adminUser.email, metadata })
    await setDefaultOrganizationMetadata(orgId, customer.id)
    return customer.id
}

const NON_PURCHASABLE_PLAN_MESSAGE = "Free plan cannot be purchased; cancel a paid subscription in the billing portal to return to Free."
// Checkout Sessions are for purchasing something new
export async function createCheckoutSessionForPlan(orgId: string, planKey: PlanKey, timePeriod: TimePeriods): Promise<Stripe.Checkout.Session> {
    if (!isPurchasablePlan(getPlanDetails(planKey))) {
        throw new Error(NON_PURCHASABLE_PLAN_MESSAGE)
    }
    const plan = getPlanDetails(planKey)
    const basePair = timePeriod === TimePeriods.MONTHLY ? plan.monthlyBasePriceId : plan.annualBasePriceId
    if (!basePair) throw new Error(`Plan ${planKey} is not subscribable for period ${timePeriod}`)

    const basePriceId = resolveEnvId(basePair)
    const customerId = await getOrCreateCustomer(orgId)

    // Only the licensed base price goes through Checkout. Metered overage is always attached
    // after payment (checkout.session.completed → ensureSubscriptionHasMeteredOverage) so
    // monthly and yearly flows stay consistent and we never mix intervals inside Checkout.
    return stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: basePriceId, quantity: 1 }],
        success_url: `${urls.frontend}${FrontendRoutes.BILLING}?upgraded=1`,
        cancel_url: `${urls.frontend}${FrontendRoutes.BILLING}`,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        customer_update: { address: "auto" },
        automatic_tax: { enabled: true },
        // Mixed intervals (yearly license + monthly metered) require flexible billing on the subscription.
        subscription_data: {
            ...(timePeriod === TimePeriods.YEARLY ? { billing_mode: { type: "flexible" as const } } : {}),
            metadata: { org_id: orgId, plan_key: planKey }
        },
        metadata: { org_id: orgId, plan_key: planKey }
    })
}

export async function createCheckoutSessionForTopup(orgId: string, packCredits: SupportedTopUps): Promise<Stripe.Checkout.Session> {
    const customerId = await getOrCreateCustomer(orgId)
    const topupPriceId = getTopUpPriceId(packCredits)

    return stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [{ price: topupPriceId, quantity: 1 }],
        success_url: `${urls.frontend}${FrontendRoutes.BILLING}?topup=1`,
        cancel_url: `${urls.frontend}${FrontendRoutes.BILLING}`,
        billing_address_collection: "auto",
        customer_update: { address: "auto" },
        automatic_tax: { enabled: true },
        invoice_creation: {
            enabled: true,
            invoice_data: {
                metadata: { type: "credit_topup", credits: packCredits.toString(), org_id: orgId }
            }
        },
        metadata: { type: "credit_topup", credits: packCredits.toString(), org_id: orgId }
    })
}

// Portal Sessions are for managing existing products
export async function createPortalSession(orgId: string): Promise<Stripe.BillingPortal.Session> {
    const customerId = await getOrCreateCustomer(orgId)
    return stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${urls.frontend}${FrontendRoutes.BILLING}`
    })
}

// Used only by webhook handlers for automated grants:
//   - customer.subscription.created → grant the plan's monthly allowance
//   - invoice.paid (renewal)         → grant the next period's allowance
//   - checkout.session.completed (topup) → grant the purchased pack
// Comp / promo grants are done manually in Stripe Dashboard (Customer → Credits → Grant credit),
// so we deliberately do NOT expose expire / void wrappers here.
export async function createCreditGrant(input: CreateCreditGrantInput): Promise<Stripe.Billing.CreditGrant> {
    const { customerId, credits, overageCentsPerCredit, category, name, expiresAt, priority, metadata, idempotencyKey } = input
    // Stripe monetary value is in cents. Grant value = credits x metered overage rate.
    const valueInCents = Math.round(credits * overageCentsPerCredit)
    return stripeClient.billing.creditGrants.create(
        {
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
        },
        {
            idempotencyKey
        }
    )
}

export async function fetchActivePaidSubscription(customerId: string): Promise<ActivePaidSubscription | null> {
    const subscription = await fetchSubscription(customerId)
    if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) return null

    const planItem = resolveSubscriptionBasePlanItem(subscription)
    if (!planItem) return null

    return {
        subscription,
        planItem: planItem.item,
        plan: planItem.plan,
        billingPeriod: billingPeriodForPriceId(planItem.item.price.id),
        period: subscriptionItemPeriod(planItem.item, subscription.id)
    }
}

export async function scheduleCancelToFree(orgId: string): Promise<BillingChangeResult> {
    const customerId = await getOrCreateCustomer(orgId)
    const active = await fetchActivePaidSubscription(customerId)
    if (!active) return { scheduledChange: null }

    const existingScheduleId = subscriptionScheduleId(active.subscription)
    if (existingScheduleId) {
        await stripeClient.subscriptionSchedules.release(existingScheduleId)
    }

    const updated = await stripeClient.subscriptions.update(active.subscription.id, {
        cancel_at_period_end: true,
        metadata: { ...active.subscription.metadata, org_id: orgId, scheduled_change: "cancel_to_free" }
    })
    const effectiveAt = new Date((updated.cancel_at ?? active.period.end.getTime() / 1000) * 1000)
    return {
        scheduledChange: {
            kind: "cancel_to_free",
            effectiveAt
        }
    }
}

export async function scheduleBillingPeriodChange(orgId: string, planKey: PlanKey, timePeriod: TimePeriods): Promise<BillingChangeResult> {
    if (!isPurchasablePlan(getPlanDetails(planKey))) {
        throw new Error(NON_PURCHASABLE_PLAN_MESSAGE)
    }

    const customerId = await getOrCreateCustomer(orgId)
    const active = await fetchActivePaidSubscription(customerId)
    if (!active) {
        throw new Error("No active paid subscription to change.")
    }

    const targetPeriod = timePeriodToBillingPeriod(timePeriod)
    if (active.plan.key === planKey && active.billingPeriod === targetPeriod) {
        return { scheduledChange: null }
    }

    const targetPlan = getPlanDetails(planKey)
    const targetBasePair = timePeriod === TimePeriods.MONTHLY ? targetPlan.monthlyBasePriceId : targetPlan.annualBasePriceId
    const targetBasePriceId = resolveEnvId(targetBasePair)
    const targetOveragePriceId = resolveEnvId(targetPlan.overagePriceId)
    if (!targetBasePriceId || !targetOveragePriceId) {
        throw new Error(`Plan ${planKey} is not subscribable for period ${timePeriod}`)
    }

    if (active.subscription.cancel_at_period_end) {
        await stripeClient.subscriptions.update(active.subscription.id, { cancel_at_period_end: false })
    }

    const existingScheduleId = subscriptionScheduleId(active.subscription)
    const schedule = existingScheduleId
        ? await stripeClient.subscriptionSchedules.retrieve(existingScheduleId)
        : await stripeClient.subscriptionSchedules.create({ from_subscription: active.subscription.id })

    await stripeClient.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
            {
                start_date: Math.floor(active.period.start.getTime() / 1000),
                end_date: Math.floor(active.period.end.getTime() / 1000),
                items: active.subscription.items.data.map(subscriptionItemToScheduleItem),
                proration_behavior: "none",
                metadata: { org_id: orgId }
            },
            {
                items: [{ price: targetBasePriceId, quantity: 1 }, { price: targetOveragePriceId }],
                proration_behavior: "none",
                metadata: { org_id: orgId, plan_key: planKey, billing_period: targetPeriod, scheduled_change: "change_period" }
            }
        ],
        proration_behavior: "none",
        metadata: { org_id: orgId, plan_key: planKey, scheduled_change: "change_period", billing_period: targetPeriod }
    })

    return {
        scheduledChange: {
            kind: "change_period",
            effectiveAt: active.period.end,
            period: targetPeriod
        }
    }
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

/** Stripe requires start_time / end_time aligned to UTC day or hour boundaries when using value_grouping_window. end_time is exclusive. */
function alignMeterEventSummaryUnixRange(start: Date, end: Date, valueGroupingWindow: "hour" | "day"): { startUnix: number; endUnix: number } | null {
    const zone = "utc"
    if (valueGroupingWindow === "day") {
        const startDt = DateTime.fromJSDate(start, { zone }).startOf("day")
        const endRaw = DateTime.fromJSDate(end, { zone })
        const endAligned = endRaw.equals(endRaw.startOf("day")) ? endRaw : endRaw.startOf("day").plus({ days: 1 })
        return toUnixRangeOrNull(startDt, endAligned)
    }
    const startDt = DateTime.fromJSDate(start, { zone }).startOf("hour")
    const endRaw = DateTime.fromJSDate(end, { zone })
    const endAligned = endRaw.equals(endRaw.startOf("hour")) ? endRaw : endRaw.startOf("hour").plus({ hours: 1 })
    return toUnixRangeOrNull(startDt, endAligned)
}

function toUnixRangeOrNull(startDt: DateTime, endDt: DateTime): { startUnix: number; endUnix: number } | null {
    const startUnix = Math.floor(startDt.toMillis() / 1000)
    const endUnix = Math.floor(endDt.toMillis() / 1000)
    if (startUnix >= endUnix) return null
    return { startUnix, endUnix }
}

export async function listMeterEventSummaries(opts: ListMeterEventSummariesInput): Promise<Stripe.Billing.MeterEventSummary[]> {
    const { meterId, customerId, start, end, valueGroupingWindow } = opts
    const aligned = alignMeterEventSummaryUnixRange(start, end, valueGroupingWindow)
    if (!aligned) return []

    const summaries = await stripeClient.billing.meters.listEventSummaries(meterId, {
        customer: customerId,
        start_time: aligned.startUnix,
        end_time: aligned.endUnix,
        value_grouping_window: valueGroupingWindow
    })
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
    idempotencyKey?: string
}

export type ActivePaidSubscription = {
    subscription: Stripe.Subscription
    planItem: Stripe.SubscriptionItem
    plan: {
        key: PlanKey
        details: ReturnType<typeof getPlanDetails>
    }
    billingPeriod: BillingPeriod
    period: { start: Date; end: Date }
}

export type BillingChangeResult = {
    scheduledChange:
        | {
              kind: "cancel_to_free"
              effectiveAt: Date
          }
        | {
              kind: "change_period"
              effectiveAt: Date
              period: BillingPeriod
          }
        | null
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
    timestamp: Date
}

function resolveBasePlanByPriceId(priceId: string): ActivePaidSubscription["plan"] | null {
    let details: ReturnType<typeof getPlanDetails>
    try {
        details = getPlanByPriceId(priceId)
    } catch {
        return null
    }

    if (!isBasePlanPrice(details, priceId)) return null
    return { key: details.key, details }
}

function billingPeriodForPriceId(priceId: string): BillingPeriod {
    for (const planKey of Object.values(PlanKey)) {
        const plan = getPlanDetails(planKey)
        if (priceMatches(plan.monthlyBasePriceId, priceId)) return "monthly"
        if (priceMatches(plan.annualBasePriceId, priceId)) return "yearly"
    }
    throw new Error(`No billing period found for Stripe price ID: ${priceId}`)
}

function isBasePlanPrice(plan: ReturnType<typeof getPlanDetails>, priceId: string): boolean {
    return priceMatches(plan.monthlyBasePriceId, priceId) || priceMatches(plan.annualBasePriceId, priceId)
}

function priceMatches(pair: { live: string; test: string } | null, priceId: string): boolean {
    return !!pair && (pair.live === priceId || pair.test === priceId)
}

function subscriptionItemPeriod(item: Stripe.SubscriptionItem, subscriptionId: string): { start: Date; end: Date } {
    const start = subscriptionItemDate(item.current_period_start, "current_period_start", subscriptionId, item.id)
    const end = subscriptionItemDate(item.current_period_end, "current_period_end", subscriptionId, item.id)
    if (start >= end) {
        throw new Error(`Subscription ${subscriptionId} plan item ${item.id} has an invalid billing period`)
    }
    return { start, end }
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

function subscriptionItemToScheduleItem(item: Stripe.SubscriptionItem): { price: string; quantity?: number } {
    return item.price.recurring?.usage_type === "metered" ? { price: item.price.id } : { price: item.price.id, quantity: item.quantity ?? 1 }
}

function subscriptionScheduleId(subscription: Stripe.Subscription): string | null {
    const schedule = subscription.schedule
    if (!schedule) return null
    return typeof schedule === "string" ? schedule : schedule.id
}

function timePeriodToBillingPeriod(period: TimePeriods): BillingPeriod {
    return period === TimePeriods.YEARLY ? "yearly" : "monthly"
}

export function resolveSubscriptionBasePlanItem(subscription: Stripe.Subscription): { item: Stripe.SubscriptionItem; plan: ActivePaidSubscription["plan"] } | null {
    for (const item of subscription.items.data) {
        const plan = resolveBasePlanByPriceId(item.price.id)
        if (plan) return { item, plan }
    }
    return null
}

export function resolveSubscriptionCreditPeriod(subscription: Stripe.Subscription, basePlanItem: Stripe.SubscriptionItem): { start: Date; end: Date; item: Stripe.SubscriptionItem } | null {
    const billingPeriod = billingPeriodForPriceId(basePlanItem.price.id)
    if (billingPeriod === "monthly") {
        const period = subscriptionItemPeriod(basePlanItem, subscription.id)
        return { ...period, item: basePlanItem }
    }

    const overageItem = resolveSubscriptionMeteredOverageItem(subscription, basePlanItem.price.id)
    if (!overageItem) return null

    const period = subscriptionItemPeriod(overageItem, subscription.id)
    return { ...period, item: overageItem }
}

export function resolveSubscriptionMeteredOverageItem(subscription: Stripe.Subscription, basePriceId: string): Stripe.SubscriptionItem | null {
    const plan = getPlanByPriceId(basePriceId)
    const overagePriceId = resolveEnvId(plan.overagePriceId)
    if (!overagePriceId) return null
    return subscription.items.data.find(item => item.price.id === overagePriceId) ?? null
}

const stripeCustomerMetadataSchema = z.object({
    organizationId: z.string()
})
export type StripeCustomerMetadata = z.infer<typeof stripeCustomerMetadataSchema>

export type StripeCustomerWithMetadata = Omit<Stripe.Customer, "metadata"> & {
    metadata: StripeCustomerMetadata
}

export async function getStripeCustomerWithMetadata(customerId: string): Promise<StripeCustomerWithMetadata | null> {
    const customer = await stripeClient.customers.retrieve(customerId)
    if (!customer || customer.deleted) {
        logger.warn("Stripe customer not found", { customerId })
        return null
    }
    const parsed = stripeCustomerMetadataSchema.parse(customer.metadata)
    return { ...customer, metadata: parsed }
}
