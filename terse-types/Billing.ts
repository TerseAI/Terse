export function getAllPlans(): Plan[] {
    return Object.values(PlanKey).map(getPlanDetails)
}

export function getPlanDetails(planKey: PlanKey): Plan {
    switch (planKey) {
        case PlanKey.FREE:
            return {
                key: PlanKey.FREE,
                name: "Free",
                monthlyBasePriceId: null,
                annualBasePriceId: null,
                overagePriceId: null,
                priceInUsdMonthly: null,
                priceInUsdMonthlyAnnual: null,
                includedCreditsPerMonth: 5000,
                markupPct: 0,
                overageCentsPerCredit: null,
                hardCapMultiplier: 1,
                defaultOverageMode: "strict",
                seats: 1,
                concurrentRuns: 1
            }
        case PlanKey.PRO:
            return {
                key: PlanKey.PRO,
                name: "Pro",
                monthlyBasePriceId: {
                    live: "price_live_REPLACE",
                    test: "price_1TRDOPPux7qhH7I9iYWXFy82"
                },
                annualBasePriceId: {
                    live: "price_live_REPLACE",
                    test: "price_1TRDSjPux7qhH7I9WaQB4Acl"
                },
                overagePriceId: {
                    live: "price_live_REPLACE",
                    test: "price_1TRDajPux7qhH7I9Ao83HhWM"
                },
                priceInUsdMonthly: 37,
                priceInUsdMonthlyAnnual: 30,
                includedCreditsPerMonth: 20000,
                markupPct: 0.3,
                overageCentsPerCredit: 0.2,
                hardCapMultiplier: 2,
                defaultOverageMode: "soft",
                seats: 3,
                concurrentRuns: 5
            }
        default: {
            const _exhaustiveCheck: never = planKey
            throw new Error(`Unhandled plan key: ${planKey}`)
        }
    }
}

export function isPurchasablePlan(planKey: PlanKey): boolean {
    const plan = getPlanDetails(planKey)
    return !!(plan.monthlyBasePriceId || plan.annualBasePriceId)
}

export function getPlanByPriceId(priceId: string): Plan {
    const matches = (pair: EnvId | null): boolean => !!pair && (pair.live === priceId || pair.test === priceId)

    for (const planKey of Object.values(PlanKey)) {
        const plan = getPlanDetails(planKey)
        if (matches(plan.monthlyBasePriceId) || matches(plan.annualBasePriceId) || matches(plan.overagePriceId)) {
            return plan
        }
    }
    throw new Error(`No plan found for Stripe price ID: ${priceId}`)
}

export type BillingPeriod = "monthly" | "yearly"
export type EnvId = { live: string; test: string }

export type BalanceSummary = {
    planKey: PlanKey
    billingPeriod: BillingPeriod | null
    planCredits: number
    consumedCredits: number
    topUpCredits: number
    totalCreditCapacity: number
    periodStart: Date
    periodEnd: Date
    overageMode: OverageMode
    hardCap: number
    canBuyTopups: boolean
    scheduledChange: BillingScheduledChange | null
}

export type UsageBucket = {
    startTimestamp: number
    endTimestamp: number
    credits: number
}

export type UsageResponse = {
    buckets: UsageBucket[]
}

export type BillingStripeRedirectResponse = {
    url: string
}

export type SetOverageModeResponse = {
    ok: true
}

export type BillingScheduledChange =
    | {
          kind: "cancel_to_free"
          effectiveAt: Date
      }
    | {
          kind: "change_period"
          effectiveAt: Date
          period: BillingPeriod
      }

// Unique identifiers for referring to plans within Terse.
export enum PlanKey {
    FREE = "free",
    PRO = "pro"
}

export type OverageMode = "soft" | "strict"

export type Plan = {
    key: PlanKey
    name: string
    monthlyBasePriceId: EnvId | null
    annualBasePriceId: EnvId | null
    overagePriceId: EnvId | null
    priceInUsdMonthly: number | null
    priceInUsdMonthlyAnnual: number | null
    includedCreditsPerMonth: number
    markupPct: number
    overageCentsPerCredit: number | null
    hardCapMultiplier: number
    defaultOverageMode: OverageMode
    seats: number | null
    concurrentRuns: number
}

export enum SupportedTopUps {
    TOPUP_10K = 10000
}

export type TopUp = {
    credits: SupportedTopUps
    priceInUsd: number
    priceId: EnvId
}

export function getTopUpDetails(credits: SupportedTopUps): TopUp {
    switch (credits) {
        case SupportedTopUps.TOPUP_10K:
            return {
                credits: SupportedTopUps.TOPUP_10K,
                priceInUsd: 18,
                priceId: TOPUP_PRICES[SupportedTopUps.TOPUP_10K]
            }
        default: {
            const _exhaustiveCheck: never = credits
            throw new Error(`Unhandled top-up credits: ${credits}`)
        }
    }
}

/** Numeric enum members only (Object.values on numeric enums also yields string keys). */
const TOPUP_CREDIT_AMOUNTS = [SupportedTopUps.TOPUP_10K] as const

export function getAllTopups(): TopUp[] {
    return TOPUP_CREDIT_AMOUNTS.map(credits => getTopUpDetails(credits))
}

export const TOPUP_PRICES: Record<SupportedTopUps, EnvId> = {
    [SupportedTopUps.TOPUP_10K]: {
        live: "price_live_REPLACE",
        test: "price_1TROAOPux7qhH7I9x0W3gCMW"
    }
}

export const CREDIT_CONSUMPTION_METER: EnvId = {
    live: "mtr_REPLACE",
    test: "mtr_test_61UabWhCrZIaq2jBW41Pux7qhH7I9NPs"
}

export enum TimePeriods {
    MONTHLY = "monthly",
    YEARLY = "yearly"
}

export type BillingCheckoutPlanBody = {
    kind: "plan"
    planKey: PlanKey
    period: TimePeriods
}

export type BillingCheckoutTopupBody = {
    kind: "topup"
    packCredits: SupportedTopUps
}

export type BillingCheckoutRequestBody = BillingCheckoutPlanBody | BillingCheckoutTopupBody

export type BillingOverageModePatchBody = {
    mode: OverageMode
}

export type BillingChangeRequestBody =
    | {
          kind: "cancel_to_free"
      }
    | {
          kind: "change_period"
          planKey: PlanKey
          period: TimePeriods
      }

export type BillingChangeResponse = {
    ok: true
    scheduledChange: BillingScheduledChange | null
}
