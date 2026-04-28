import { OverageMode, type billing_customers } from "@prisma/client"
import { DateTime } from "luxon"
import type Stripe from "stripe"

import { dollarsToCredits } from "../config/creditEconomics"
import { priceFor } from "../config/modelPrices"
import { PlanKey, getPlanByPriceId, getPlanDetails, getPlanKeyByPriceId } from "../config/plans"
import logger from "../logger"
import { db } from "../prismaClient"

import { sendBillingThresholdNotification } from "./BillingNotificationDispatcher"
import { evaluateAndRecordThresholds } from "./BillingNotifications"
import { fetchSubscription, postMeterEvent } from "./PaymentsProviderService"

export type LLMUsage = {
    provider: string
    model: string
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
    includedCredits: number
    consumedCredits: number
    periodStart: Date
    periodEnd: Date
    overageMode: "soft" | "strict"
    hardCap: number
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

type BillingContext = {
    plan: ResolvedPlan
    periodStart: Date
    periodEnd: Date
    overageMode: "soft" | "strict"
    hardCap: number
    meteredCustomerId: string | null
}

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
        if (!subscription) {
            return { allow: false, reason: "no_subscription" }
        }
        if (subscription.status === "past_due") {
            return { allow: false, reason: "subscription_past_due" }
        }

        const plan = resolvePlanBySubscription(subscription).details
        const period = subscriptionPeriod(subscription)
        const consumption = await ensurePeriodConsumption(orgId, period.start, period.end)
        const overageMode = customer.overage_mode ?? plan.defaultOverageMode
        const hardCap = computeHardCap(plan, overageMode, customer.overage_cap_multiplier)

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
        if (consumption.consumed_credits > context.hardCap) {
            throw new CreditsExhaustedError()
        }
    }

    // Charge for LLM usage when the step finishes, based on the input/output tokens and model used
    async recordLLMCall(orgId: string, runId: string, stepKey: string, usage: LLMUsage): Promise<{ creditsCharged: number; rawCostMicros: bigint }> {
        const price = priceFor(usage.provider, usage.model)
        if (!price) {
            throw new Error(`Unpriced model: ${usage.provider}/${usage.model}`)
        }

        const rawCostMicros =
            BigInt(usage.inputTokens) * microsPerToken(price.inputCentsPer1k) +
            BigInt(usage.outputTokens) * microsPerToken(price.outputCentsPer1k) +
            BigInt(usage.cachedTokens) * microsPerToken(price.cachedCentsPer1k)

        const customer = await db().billing_customers.findUnique({ where: { organization_id: orgId } })
        const context = await this.resolveBillingContext(orgId, customer)
        const markupBp = BigInt(Math.round(context.plan.details.markupPct * 10_000))
        const markedUpCostMicros = rawCostMicros + (rawCostMicros * markupBp) / 10_000n
        const credits = dollarsToCredits(markedUpCostMicros)
        const key = `${runId}:${stepKey}:llm`

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
        if (consumption.consumed_credits > context.hardCap) {
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

        return {
            planKey: context.plan.key,
            includedCredits: context.plan.details.includedCreditsPerMonth,
            consumedCredits: consumption.consumed_credits,
            periodStart: consumption.period_start,
            periodEnd: consumption.period_end,
            overageMode: context.overageMode,
            hardCap: context.hardCap
        }
    }

    private async resolveBillingContext(orgId: string, customer: billing_customers | null): Promise<BillingContext> {
        if (!customer?.stripe_customer_id) {
            const plan = { key: PlanKey.FREE, details: getPlanDetails(PlanKey.FREE) }
            const consumption = await ensureFreePeriodConsumption(orgId)
            return {
                plan,
                periodStart: consumption.period_start,
                periodEnd: consumption.period_end,
                overageMode: plan.details.defaultOverageMode,
                hardCap: computeHardCap(plan.details, plan.details.defaultOverageMode),
                meteredCustomerId: null
            }
        }

        const subscription = await fetchSubscription(customer.stripe_customer_id)
        if (!subscription || subscription.status === "past_due") {
            const plan = { key: PlanKey.FREE, details: getPlanDetails(PlanKey.FREE) }
            const period = currentFreePeriod()
            return {
                plan,
                periodStart: period.start,
                periodEnd: period.end,
                overageMode: plan.details.defaultOverageMode,
                hardCap: computeHardCap(plan.details, plan.details.defaultOverageMode),
                meteredCustomerId: null
            }
        }

        const plan = resolvePlanBySubscription(subscription)
        const period = subscriptionPeriod(subscription)
        await ensurePeriodConsumption(orgId, period.start, period.end)
        const overageMode = customer.overage_mode ?? plan.details.defaultOverageMode

        return {
            plan,
            periodStart: period.start,
            periodEnd: period.end,
            overageMode,
            hardCap: computeHardCap(plan.details, overageMode, customer.overage_cap_multiplier),
            meteredCustomerId: customer.stripe_customer_id
        }
    }
}

function microsPerToken(cents: number): bigint {
    return BigInt(Math.round((cents * 10_000) / 1_000))
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
    const priceId = subscription.items.data[0]?.price.id
    if (!priceId) {
        throw new Error("Subscription has no price item")
    }

    const details = getPlanByPriceId(priceId)
    const key = getPlanKeyByPriceId(priceId)
    return { key, details }
}

function subscriptionPeriod(subscription: Stripe.Subscription): { start: Date; end: Date } {
    const sub = subscription as Stripe.Subscription & { current_period_start: number; current_period_end: number }
    return {
        start: new Date(sub.current_period_start * 1000),
        end: new Date(sub.current_period_end * 1000)
    }
}

function computeHardCap(plan: ReturnType<typeof getPlanDetails>, overageMode: OverageMode | "soft" | "strict", multiplier?: { toString(): string } | number | null): number {
    if (overageMode === "strict") {
        return plan.includedCreditsPerMonth
    }
    return Math.floor(plan.includedCreditsPerMonth * Number(multiplier ?? plan.hardCapMultiplier))
}

function toStripeUnavailableError(error: unknown): StripeUnavailableError {
    if (error instanceof StripeUnavailableError) return error
    const message = error instanceof Error ? error.message : "Stripe is temporarily unavailable"
    return new StripeUnavailableError(message)
}

export const creditService = new CreditService()
