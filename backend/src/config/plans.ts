import type { EnvId, Plan, TopUp } from "terse-types"
import { PlanKey, SupportedTopUps, TimePeriods } from "terse-types"

import { stripe } from "./settings"

export { PlanKey, SupportedTopUps, TimePeriods }

export const CREDIT_CONSUMPTION_METER: EnvId = {
    live: "mtr_REPLACE",
    test: "mtr_test_61UabWhCrZIaq2jBW41Pux7qhH7I9NPs"
}

export const TOPUP_PRICES: Record<SupportedTopUps, EnvId> = {
    [SupportedTopUps.TOPUP_10K]: {
        live: "price_live_REPLACE",
        test: "price_1TROAOPux7qhH7I9x0W3gCMW"
    }
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
                includedCreditsPerMonth: 1700,
                markupPct: 0,
                overageCentsPerCredit: null,
                hardCapMultiplier: 1,
                defaultOverageMode: "strict"
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
                includedCreditsPerMonth: 100,
                markupPct: 0.3,
                overageCentsPerCredit: 0.2,
                hardCapMultiplier: 2,
                defaultOverageMode: "soft"
            }
        default: {
            const _exhaustiveCheck: never = planKey
            throw new Error(`Unhandled plan key: ${planKey}`)
        }
    }
}

export function getAllPlans(): Plan[] {
    return Object.values(PlanKey).map(getPlanDetails)
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

const TOPUP_CREDIT_AMOUNTS = [SupportedTopUps.TOPUP_10K] as const

export function getAllTopups(): TopUp[] {
    return TOPUP_CREDIT_AMOUNTS.map(credits => getTopUpDetails(credits))
}

export function getPlanKeyByPriceId(priceId: string): PlanKey {
    return getPlanByPriceId(priceId).key
}

export function getCreditConsumptionMeterId(): string {
    return resolveEnvId(CREDIT_CONSUMPTION_METER)
}

export function resolveEnvId(pair: EnvId): string
export function resolveEnvId(pair: EnvId | null): string | null
export function resolveEnvId(pair: EnvId | null): string | null {
    if (!pair) return null
    return stripe.isTestMode ? pair.test : pair.live
}

export function getTopUpPriceId(packCredits: SupportedTopUps): string {
    return resolveEnvId(TOPUP_PRICES[packCredits])
}
