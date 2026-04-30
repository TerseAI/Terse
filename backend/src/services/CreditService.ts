import { DateTime } from "luxon"
import { dollarsToCredits } from "src/config/modelPrices"
import type Stripe from "stripe"
import { OverageMode } from "terse-types"
import type { BalanceSummary, BillingContextResponse } from "terse-types"

import { ModelReference } from "../agent/modelRegistry"
import { priceFor } from "../config/modelPrices"
import { PlanKey, getCreditConsumptionMeterId, getPlanByPriceId, getPlanDetails } from "../config/plans"
import logger from "../logger"
import { db } from "../prismaClient"
import { getOrganizationWithMetadata } from "../routes/auth"

import { emitBillingCachesInvalidated } from "./CacheInvalidationService"
import {
    fetchCreditBalanceSummary,
    fetchSubscription,
    getOrCreateCustomer,
    listMeterEventSummaries,
    postMeterEvent,
    resolveSubscriptionBasePlanItem,
    resolveSubscriptionCreditPeriod,
    stripeClient
} from "./PaymentsProviderService"

export class CreditService {
    // Pre-run gate check to see if the run should be allowed to proceed based on subscription and credit status
    async checkRunGate(orgId: string, email: string): Promise<GateDecision> {
        const context = await this.resolveBillingContext(orgId)
        const plan = context.plan.details
        const consumedCredits = await consumedCreditsForPeriod(context)

        if (context.overageMode === "strict") {
            const availability = await creditAvailability({ customerId: context.creditBalanceCustomerId, plan, consumedCredits })
            const planRemaining = Math.max(0, plan.includedCreditsPerMonth - consumedCredits)
            if (planRemaining + availability.topUpCredits <= 0) {
                return { allow: false, reason: "credits_exhausted" }
            }
            return { allow: true }
        }

        if (consumedCredits >= context.hardCap) {
            return { allow: false, reason: "credits_exhausted" }
        }
        return { allow: true }
    }

    // Charge for the base run cost (1 credit) when the run starts
    async chargeRunBase(orgId: string, email: string, runId: string): Promise<void> {
        const key = `${runId}:run_base`
        const context = await this.resolveBillingContext(orgId)

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

        emitBillingCachesInvalidated(orgId)
    }

    // Charge for LLM usage when the step finishes, based on the input/output tokens and model used
    async recordLLMCall(orgId: string, email: string, runId: string, response: LLMResponseWithUsage): Promise<{ creditsCharged: number; rawCostMicros: bigint }> {
        const price = priceFor(response.model)
        if (!price) {
            throw new Error(`Unpriced model: ${response.model.providerId}/${response.model.modelId}`)
        }

        const rawCostMicros =
            costMicros(response.usage.inputTokens, price.inputUsdPer1M) +
            costMicros(response.usage.outputTokens, price.outputUsdPer1M) +
            costMicros(response.usage.inputTokensDetails.cached_tokens, price.cachedInputUsdPer1M)
        const context = await this.resolveBillingContext(orgId)
        const markupBp = BigInt(Math.round(context.plan.details.markupPct * 10_000))
        const markedUpCostMicros = rawCostMicros + (rawCostMicros * markupBp) / 10_000n
        const credits = dollarsToCredits(markedUpCostMicros)
        const key = `${runId}:${response.responseId}:llm`

        const rawCostUsd = Number(rawCostMicros) / 1_000_000
        const markedUpCostUsd = Number(markedUpCostMicros) / 1_000_000
        const totalBillableTokens = response.usage.inputTokens + response.usage.outputTokens + response.usage.inputTokensDetails.cached_tokens

        logger.info(`LLM usage cost: ${key} — ${totalBillableTokens} billable tokens`, {
            event: "llm_usage_cost",
            organizationId: orgId,
            runId,
            key,
            meterIdentifier: key,
            provider: response.model.providerId,
            model: response.model.modelId,
            responseId: response.responseId,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            cachedTokens: response.usage.inputTokensDetails.cached_tokens,
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
        })

        if (credits === 0) {
            return { creditsCharged: 0, rawCostMicros }
        }

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

        emitBillingCachesInvalidated(orgId)

        return { creditsCharged: credits, rawCostMicros }
    }

    async getBillingContext(orgId: string, usageRange: { start: Date; end: Date }): Promise<BillingContextResponse> {
        const customerId = await getOrCreateCustomer(orgId)
        const context = await this.resolveBillingContextWithCustomer(orgId, customerId)
        const consumedCredits = await consumedCreditsForPeriod(context)
        const availability = await creditAvailability({
            customerId: context.creditBalanceCustomerId,
            plan: context.plan.details,
            consumedCredits
        })

        const balance: BalanceSummary = {
            planKey: context.plan.key,
            billingPeriod: context.billingPeriod,
            planCredits: context.plan.details.includedCreditsPerMonth,
            consumedCredits,
            topUpCredits: availability.topUpCredits,
            totalCreditCapacity: availability.totalCreditCapacity,
            periodStart: context.periodStart,
            periodEnd: context.periodEnd,
            overageMode: context.overageMode,
            hardCap: context.hardCap,
            canBuyTopups: !!context.creditBalanceCustomerId,
            scheduledChange: context.scheduledChange
        }

        const chartSummaries = await listMeterEventSummaries({
            meterId: getCreditConsumptionMeterId(),
            customerId,
            start: usageRange.start,
            end: usageRange.end,
            valueGroupingWindow: "day"
        })

        return {
            balance,
            usage: {
                buckets: chartSummaries.map(summary => ({
                    startTimestamp: summary.start_time * 1000,
                    endTimestamp: summary.end_time * 1000,
                    credits: Number(summary.aggregated_value)
                }))
            }
        }
    }

    private async resolveBillingContext(orgId: string): Promise<BillingContext> {
        const customerId = await getOrCreateCustomer(orgId)
        return this.resolveBillingContextWithCustomer(orgId, customerId)
    }

    private async resolveBillingContextWithCustomer(orgId: string, customerId: string): Promise<BillingContext> {
        const organizationWithMetadata = await getOrganizationWithMetadata(orgId)
        const subscription = await fetchSubscription(customerId)
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
                creditBalanceCustomerId: customerId,
                meteredCustomerId: customerId,
                scheduledChange: null
            }
        }

        const subscriptionPlanItem = resolveRequiredSubscriptionBasePlanItem(subscription)
        const plan = subscriptionPlanItem.plan
        const period = resolveRequiredSubscriptionCreditPeriod(subscription, subscriptionPlanItem.item)
        const overageMode = organizationWithMetadata.metadata.overageMode ?? plan.details.defaultOverageMode
        return {
            plan,
            billingPeriod: billingPeriodForPriceId(subscriptionPlanItem.item.price.id),
            periodStart: period.start,
            periodEnd: period.end,
            overageMode: organizationWithMetadata.metadata.overageMode,
            hardCap: computeHardCap(plan.details, overageMode, organizationWithMetadata.metadata.overageCapMultiplier),
            creditBalanceCustomerId: customerId,
            meteredCustomerId: customerId,
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

async function consumedCreditsForPeriod(context: BillingContext): Promise<number> {
    const summaries = await listMeterEventSummaries({
        meterId: getCreditConsumptionMeterId(),
        customerId: context.meteredCustomerId,
        start: context.periodStart,
        end: context.periodEnd,
        valueGroupingWindow: "day"
    })
    return summaries.reduce((sum, summary) => sum + Number(summary.aggregated_value), 0)
}

function resolveRequiredSubscriptionBasePlanItem(subscription: Stripe.Subscription): SubscriptionPlanItem {
    const planItem = resolveSubscriptionBasePlanItem(subscription)
    if (!planItem) {
        throw new Error(`Subscription ${subscription.id} has no Terse base plan price item`)
    }
    return planItem
}

function resolveRequiredSubscriptionCreditPeriod(subscription: Stripe.Subscription, basePlanItem: Stripe.SubscriptionItem): { start: Date; end: Date; item: Stripe.SubscriptionItem } {
    const creditPeriod = resolveSubscriptionCreditPeriod(subscription, basePlanItem)
    if (!creditPeriod) {
        throw new Error(`Subscription ${subscription.id} has no metered overage item for annual credit period`)
    }
    return creditPeriod
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
    const centsPerCredit = creditGrantCentsPerCredit(input.plan)
    if (!input.customerId || !centsPerCredit) {
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
    const topUpCreditCapacity = Math.floor(availableValueCents / centsPerCredit)
    const consumedFromTopUp = Math.max(0, input.consumedCredits - planCredits)
    return {
        topUpCredits: Math.max(0, topUpCreditCapacity - consumedFromTopUp),
        totalCreditCapacity: planCredits + topUpCreditCapacity
    }
}

function creditGrantCentsPerCredit(plan: ReturnType<typeof getPlanDetails>): number | null {
    return plan.overageCentsPerCredit ?? getPlanDetails(PlanKey.PRO).overageCentsPerCredit
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

export type LLMResponseWithUsage = {
    responseId: string
    model: ModelReference
    usage: CompletedEventUsage
}

export type GateAllowed = { allow: true }
export type GateDenied = { allow: false; reason: GateDenyReason }
export type GateDecision = GateAllowed | GateDenied

export type GateDenyReason = "credits_exhausted" | "subscription_past_due" | "no_subscription"

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
    creditBalanceCustomerId: string
    meteredCustomerId: string
    scheduledChange: BillingScheduledChange | null
}

export type CompletedEventUsage = {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    inputTokensDetails: { cached_tokens: number }
}

export class CreditGateDeniedError extends Error {
    readonly reason: GateDenyReason
    constructor(reason: GateDenyReason) {
        super(`Credit gate denied: ${reason}`)
        this.name = "CreditGateDeniedError"
        this.reason = reason
    }
}

export const creditService = new CreditService()
