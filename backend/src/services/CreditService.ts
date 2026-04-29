import { OverageMode, type billing_customers } from "@prisma/client"
import { DateTime } from "luxon"
import type Stripe from "stripe"

import { ModelReference } from "../agent/modelRegistry"
import { dollarsToCredits } from "../config/creditEconomics"
import { priceFor } from "../config/modelPrices"
import { PlanKey, getPlanByPriceId, getPlanDetails } from "../config/plans"
import logger from "../logger"
import { db } from "../prismaClient"

import { sendBillingThresholdNotification } from "./BillingNotificationDispatcher"
import { evaluateAndRecordThresholds } from "./BillingNotifications"
import { fetchCreditBalanceSummary, fetchSubscription, postMeterEvent, stripeClient } from "./PaymentsProviderService"

export class CreditService {
    // Pre-run gate check to see if the run should be allowed to proceed based on subscription and credit status
    async checkRunGate(orgId: string): Promise<GateDecision> {
        const prisma = db()
        const customer = await prisma.billing_customers.findUnique({ where: { organization_id: orgId } })

        if (!customer?.stripe_customer_id) {
            const plan = getPlanDetails(PlanKey.FREE)
            const consumption = await ensureFreePeriodConsumption(orgId)
            if (consumption.consumed_credits >= plan.includedCreditsPerMonth) {
                return { allow: false, reason: "credits_exhausted" }
            }
            return { allow: true }
        }

        const subscription = await fetchSubscription(customer.stripe_customer_id)

        if (!subscription || subscription.status === "past_due") {
            const plan = getPlanDetails(PlanKey.FREE)
            const consumption = await ensureFreePeriodConsumption(orgId)
            if (consumption.consumed_credits >= plan.includedCreditsPerMonth) {
                return { allow: false, reason: "credits_exhausted" }
            }
            return { allow: true }
        }

        const subscriptionPlanItem = resolvePlanItemBySubscription(subscription)
        const plan = subscriptionPlanItem.plan.details
        const period = subscriptionPeriod(subscriptionPlanItem.item, subscription.id)
        const consumption = await ensurePeriodConsumption(orgId, period.start, period.end)
        const overageMode = customer.overage_mode ?? plan.defaultOverageMode
        const hardCap = computeHardCap(plan, overageMode, customer.overage_cap_multiplier)

        if (overageMode === "strict") {
            const availability = await creditAvailability({ customerId: customer.stripe_customer_id, plan, consumedCredits: consumption.consumed_credits })
            const planRemaining = Math.max(0, plan.includedCreditsPerMonth - consumption.consumed_credits)
            if (planRemaining + availability.topUpCredits <= 0) {
                return { allow: false, reason: "credits_exhausted" }
            }
            return { allow: true }
        }

        if (consumption.consumed_credits >= hardCap) {
            return { allow: false, reason: "credits_exhausted" }
        }
        return { allow: true }
    }

    // Charge for the base run cost (1 credit) when the run starts
    async chargeRunBase(orgId: string, runId: string): Promise<void> {
        const key = `${runId}:run_base`

        const customer = await db().billing_customers.findUnique({ where: { organization_id: orgId } })
        const context = await this.resolveBillingContext(orgId, customer)

        if (context.meteredCustomerId) {
            try {
                await postMeterEvent({
                    eventName: "credit_consumption",
                    customerId: context.meteredCustomerId,
                    value: 1,
                    identifier: key,
                    timestamp: new Date()
                })
            } catch (error) {
                throw toStripeUnavailableError(error)
            }
        }

        const before = await currentConsumption(orgId)
        const consumption = await incrementConsumption(orgId, context.periodStart, context.periodEnd, 1)
        await fireThresholdsIfAny(orgId, before, consumption.consumed_credits, context)
        if (await creditsExceeded(context, consumption.consumed_credits)) {
            throw new CreditsExhaustedError()
        }
    }

    // Charge for LLM usage when the step finishes, based on the input/output tokens and model used
    async recordLLMCall(orgId: string, runId: string, stepKey: string, usage: LLMUsage): Promise<{ creditsCharged: number; rawCostMicros: bigint }> {
        const price = priceFor(usage.model)
        if (!price) {
            throw new Error(`Unpriced model: ${usage.model.providerId}/${usage.model.modelId}`)
        }

        const rawCostMicros = costMicros(usage.inputTokens, price.inputUsdPer1M) + costMicros(usage.outputTokens, price.outputUsdPer1M) + costMicros(usage.cachedTokens, price.cachedInputUsdPer1M)
        const customer = await db().billing_customers.findUnique({ where: { organization_id: orgId } })
        const context = await this.resolveBillingContext(orgId, customer)
        const markupBp = BigInt(Math.round(context.plan.details.markupPct * 10_000))
        const markedUpCostMicros = rawCostMicros + (rawCostMicros * markupBp) / 10_000n
        const credits = dollarsToCredits(markedUpCostMicros)
        const key = `${runId}:${stepKey}:llm`

        const rawCostUsd = Number(rawCostMicros) / 1_000_000
        const markedUpCostUsd = Number(markedUpCostMicros) / 1_000_000
        const totalBillableTokens = usage.inputTokens + usage.outputTokens + usage.cachedTokens

        logger.info(
            `LLM usage cost: ${usage.model.providerId}/${usage.model.modelId} — ${totalBillableTokens} billable tokens (${usage.inputTokens} non-cached in, ${usage.outputTokens} out, ${usage.cachedTokens} cached) — raw $${rawCostUsd.toFixed(6)} → after ${context.plan.details.markupPct}% markup $${markedUpCostUsd.toFixed(6)} (${credits} credits) — org ${orgId} run ${runId} [${stepKey}]`,
            {
                event: "llm_usage_cost",
                organizationId: orgId,
                runId,
                stepKey,
                meterIdentifier: key,
                provider: usage.model.providerId,
                model: usage.model.modelId,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cachedTokens: usage.cachedTokens,
                totalBillableTokens,
                rawCostUsd,
                markedUpCostUsd,
                planKey: context.plan.key,
                planMarkupPct: context.plan.details.markupPct,
                creditsComputed: credits,
                priceInputUsdPer1M: price.inputUsdPer1M,
                priceOutputUsdPer1M: price.outputUsdPer1M,
                priceCachedInputUsdPer1M: price.cachedInputUsdPer1M,
                hasMeteredBilling: !!context.meteredCustomerId
            }
        )

        if (credits === 0) {
            return { creditsCharged: 0, rawCostMicros }
        }

        if (context.meteredCustomerId) {
            try {
                await postMeterEvent({
                    eventName: "credit_consumption",
                    customerId: context.meteredCustomerId,
                    value: credits,
                    identifier: key,
                    timestamp: new Date()
                })
            } catch (error) {
                throw toStripeUnavailableError(error)
            }
        }

        const before = await currentConsumption(orgId)
        const consumption = await incrementConsumption(orgId, context.periodStart, context.periodEnd, credits)
        await fireThresholdsIfAny(orgId, before, consumption.consumed_credits, context)
        if (await creditsExceeded(context, consumption.consumed_credits)) {
            throw new CreditsExhaustedError()
        }

        return { creditsCharged: credits, rawCostMicros }
    }

    // Get the current credit balance for the org.
    async getBalanceSummary(orgId: string): Promise<BalanceSummary> {
        const prisma = db()
        const customer = await prisma.billing_customers.findUnique({ where: { organization_id: orgId } })
        const context = await this.resolveBillingContext(orgId, customer)
        const consumption = await ensurePeriodConsumption(orgId, context.periodStart, context.periodEnd)
        const availability = await creditAvailability({
            customerId: context.meteredCustomerId,
            plan: context.plan.details,
            consumedCredits: consumption.consumed_credits
        })

        return {
            planKey: context.plan.key,
            billingPeriod: context.billingPeriod,
            planCredits: context.plan.details.includedCreditsPerMonth,
            consumedCredits: consumption.consumed_credits,
            topUpCredits: availability.topUpCredits,
            totalCreditCapacity: availability.totalCreditCapacity,
            periodStart: consumption.period_start,
            periodEnd: consumption.period_end,
            overageMode: context.overageMode,
            hardCap: context.hardCap,
            canBuyTopups: !!context.meteredCustomerId && !!context.plan.details.overageCentsPerCredit,
            scheduledChange: context.scheduledChange
        }
    }

    private async resolveBillingContext(orgId: string, customer: billing_customers | null): Promise<BillingContext> {
        if (!customer?.stripe_customer_id) {
            const plan = { key: PlanKey.FREE, details: getPlanDetails(PlanKey.FREE) }
            const consumption = await ensureFreePeriodConsumption(orgId)
            return {
                plan,
                billingPeriod: null,
                periodStart: consumption.period_start,
                periodEnd: consumption.period_end,
                overageMode: plan.details.defaultOverageMode,
                hardCap: computeHardCap(plan.details, plan.details.defaultOverageMode),
                meteredCustomerId: null,
                scheduledChange: null
            }
        }

        const subscription = await fetchSubscription(customer.stripe_customer_id)
        if (!subscription || subscription.status === "past_due") {
            const plan = { key: PlanKey.FREE, details: getPlanDetails(PlanKey.FREE) }
            const period = currentFreePeriod()
            return {
                plan,
                billingPeriod: null,
                periodStart: period.start,
                periodEnd: period.end,
                overageMode: plan.details.defaultOverageMode,
                hardCap: computeHardCap(plan.details, plan.details.defaultOverageMode),
                meteredCustomerId: null,
                scheduledChange: null
            }
        }

        const subscriptionPlanItem = resolvePlanItemBySubscription(subscription)
        const plan = subscriptionPlanItem.plan
        const period = subscriptionPeriod(subscriptionPlanItem.item, subscription.id)
        await ensurePeriodConsumption(orgId, period.start, period.end)
        const overageMode = customer.overage_mode ?? plan.details.defaultOverageMode

        return {
            plan,
            billingPeriod: billingPeriodForPriceId(subscriptionPlanItem.item.price.id),
            periodStart: period.start,
            periodEnd: period.end,
            overageMode,
            hardCap: computeHardCap(plan.details, overageMode, customer.overage_cap_multiplier),
            meteredCustomerId: customer.stripe_customer_id,
            scheduledChange: await scheduledChangeForSubscription(subscription, subscriptionPlanItem.item)
        }
    }
}

function costMicros(tokens: number, usdPer1M: number): bigint {
    return BigInt(Math.round(tokens * usdPer1M))
}

function currentFreePeriod(): { start: Date; end: Date } {
    const now = DateTime.utc()
    const start = DateTime.utc(now.year, now.month, 1).toJSDate()
    const end = DateTime.utc(now.year, now.month, 1).plus({ months: 1 }).toJSDate()
    return { start, end }
}

async function ensureFreePeriodConsumption(orgId: string) {
    const period = currentFreePeriod()
    return ensurePeriodConsumption(orgId, period.start, period.end, true)
}

async function ensurePeriodConsumption(orgId: string, periodStart: Date, periodEnd: Date, resetExpired = false) {
    const prisma = db()
    const existing = await prisma.billing_period_consumption.findUnique({ where: { organization_id: orgId } })
    const now = new Date()

    if (!existing) {
        return prisma.billing_period_consumption.create({
            data: {
                organization_id: orgId,
                period_start: periodStart,
                period_end: periodEnd,
                consumed_credits: 0,
                notified_thresholds: []
            }
        })
    }

    const periodMismatch = existing.period_start.getTime() !== periodStart.getTime() || existing.period_end.getTime() !== periodEnd.getTime()
    if (periodMismatch || (resetExpired && existing.period_end <= now)) {
        return prisma.billing_period_consumption.update({
            where: { organization_id: orgId },
            data: {
                period_start: periodStart,
                period_end: periodEnd,
                consumed_credits: 0,
                notified_thresholds: []
            }
        })
    }

    return existing
}

async function incrementConsumption(orgId: string, periodStart: Date, periodEnd: Date, credits: number) {
    await ensurePeriodConsumption(orgId, periodStart, periodEnd)
    return db().billing_period_consumption.update({
        where: { organization_id: orgId },
        data: { consumed_credits: { increment: credits } }
    })
}

async function currentConsumption(orgId: string): Promise<number> {
    const row = await db().billing_period_consumption.findUnique({ where: { organization_id: orgId } })
    return row?.consumed_credits ?? 0
}

async function fireThresholdsIfAny(orgId: string, before: number, after: number, context: BillingContext): Promise<void> {
    const fresh = await evaluateAndRecordThresholds(orgId, before, after, {
        includedCredits: context.plan.details.includedCreditsPerMonth,
        hardCap: context.hardCap,
        overageMode: context.overageMode
    })

    for (const event of fresh) {
        void sendBillingThresholdNotification(orgId, event).catch(error => {
            logger.error("Failed to send billing threshold notification", { error, orgId, threshold: event.threshold })
        })
    }
}

function resolvePlanBySubscription(subscription: Stripe.Subscription): ResolvedPlan {
    return resolvePlanItemBySubscription(subscription).plan
}

function resolvePlanItemBySubscription(subscription: Stripe.Subscription): SubscriptionPlanItem {
    for (const item of subscription.items.data) {
        const plan = resolveBasePlanByPriceId(item.price.id)
        if (plan) return { item, plan }
    }

    throw new Error(`Subscription ${subscription.id} has no Terse base plan price item`)
}

function resolveBasePlanByPriceId(priceId: string): ResolvedPlan | null {
    let details: ReturnType<typeof getPlanDetails>
    try {
        details = getPlanByPriceId(priceId)
    } catch {
        return null
    }

    if (!isBasePlanPrice(details, priceId)) return null
    return { key: details.key, details }
}

function billingPeriodForPriceId(priceId: string): "monthly" | "yearly" {
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

function subscriptionPeriod(item: Stripe.SubscriptionItem, subscriptionId: string): { start: Date; end: Date } {
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

function computeHardCap(plan: ReturnType<typeof getPlanDetails>, overageMode: OverageMode | "soft" | "strict", multiplier?: { toString(): string } | number | null): number {
    if (overageMode === "strict") {
        return plan.includedCreditsPerMonth
    }
    return Math.floor(plan.includedCreditsPerMonth * Number(multiplier ?? plan.hardCapMultiplier))
}

async function creditAvailability(input: {
    customerId: string | null
    plan: ReturnType<typeof getPlanDetails>
    consumedCredits: number
}): Promise<{ topUpCredits: number; totalCreditCapacity: number }> {
    const planCredits = input.plan.includedCreditsPerMonth
    if (!input.customerId || !input.plan.overageCentsPerCredit) {
        return { topUpCredits: 0, totalCreditCapacity: planCredits }
    }

    const summary = await fetchCreditBalanceSummary(input.customerId, {
        type: "applicability_scope",
        applicability_scope: { price_type: "metered" }
    })
    const availableValueCents = summary.balances.reduce((sum, balance) => {
        const monetary = balance.available_balance.monetary
        if (!monetary || monetary.currency !== "usd") return sum
        return sum + monetary.value
    }, 0)
    const topUpCreditCapacity = Math.floor(availableValueCents / input.plan.overageCentsPerCredit)
    const consumedFromTopUp = Math.max(0, input.consumedCredits - planCredits)
    return {
        topUpCredits: Math.max(0, topUpCreditCapacity - consumedFromTopUp),
        totalCreditCapacity: planCredits + topUpCreditCapacity
    }
}

async function creditsExceeded(context: BillingContext, consumedCredits: number): Promise<boolean> {
    if (context.overageMode !== "strict") {
        return consumedCredits > context.hardCap
    }
    const availability = await creditAvailability({
        customerId: context.meteredCustomerId,
        plan: context.plan.details,
        consumedCredits
    })
    return consumedCredits > availability.totalCreditCapacity
}

async function scheduledChangeForSubscription(subscription: Stripe.Subscription, planItem: Stripe.SubscriptionItem): Promise<BillingScheduledChange | null> {
    if (subscription.cancel_at_period_end) {
        const effectiveAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : subscriptionPeriod(planItem, subscription.id).end
        return { kind: "cancel_to_free", effectiveAt }
    }

    const scheduleId = subscriptionScheduleId(subscription)
    if (!scheduleId) return null

    const schedule = await stripeClient.subscriptionSchedules.retrieve(scheduleId)
    const currentPhaseEnd = schedule.current_phase?.end_date
    const futurePhase = schedule.phases.find(phase => currentPhaseEnd && phase.start_date === currentPhaseEnd)
    const nextBasePrice = futurePhase?.items.map(item => (typeof item.price === "string" ? item.price : item.price.id)).find(priceId => resolveBasePlanByPriceId(priceId))
    if (!currentPhaseEnd || !nextBasePrice) return null

    return {
        kind: "change_period",
        effectiveAt: new Date(currentPhaseEnd * 1000),
        period: billingPeriodForPriceId(nextBasePrice)
    }
}

function subscriptionScheduleId(subscription: Stripe.Subscription): string | null {
    const schedule = subscription.schedule
    if (!schedule) return null
    return typeof schedule === "string" ? schedule : schedule.id
}

function toStripeUnavailableError(error: unknown): StripeUnavailableError {
    if (error instanceof StripeUnavailableError) return error
    const message = error instanceof Error ? error.message : "Stripe is temporarily unavailable"
    return new StripeUnavailableError(message)
}

export type LLMUsage = {
    model: ModelReference
    inputTokens: number
    outputTokens: number
    cachedTokens: number
}

export type GateAllowed = { allow: true }
export type GateDenied = { allow: false; reason: GateDenyReason }
export type GateDecision = GateAllowed | GateDenied

export type GateDenyReason = "credits_exhausted" | "subscription_past_due" | "no_subscription"

export type BalanceSummary = {
    planKey: PlanKey
    billingPeriod: "monthly" | "yearly" | null
    planCredits: number
    consumedCredits: number
    topUpCredits: number
    totalCreditCapacity: number
    periodStart: Date
    periodEnd: Date
    overageMode: "soft" | "strict"
    hardCap: number
    canBuyTopups: boolean
    scheduledChange: BillingScheduledChange | null
}

type BillingScheduledChange =
    | {
          kind: "cancel_to_free"
          effectiveAt: Date
      }
    | {
          kind: "change_period"
          effectiveAt: Date
          period: "monthly" | "yearly"
      }

export class StripeUnavailableError extends Error {
    constructor(message = "Stripe is temporarily unavailable") {
        super(message)
        this.name = "StripeUnavailableError"
    }
}

export class CreditsExhaustedError extends Error {
    constructor(message = "Credits exhausted") {
        super(message)
        this.name = "CreditsExhaustedError"
    }
}

type ResolvedPlan = {
    key: PlanKey
    details: ReturnType<typeof getPlanDetails>
}

type SubscriptionPlanItem = {
    item: Stripe.SubscriptionItem
    plan: ResolvedPlan
}

type BillingContext = {
    plan: ResolvedPlan
    billingPeriod: "monthly" | "yearly" | null
    periodStart: Date
    periodEnd: Date
    overageMode: "soft" | "strict"
    hardCap: number
    meteredCustomerId: string | null
    scheduledChange: BillingScheduledChange | null
}

export const creditService = new CreditService()
