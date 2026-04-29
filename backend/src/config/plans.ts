import { CREDIT_CONSUMPTION_METER, type EnvId, PlanKey, SupportedTopUps, TOPUP_PRICES, TimePeriods, getPlanByPriceId, getPlanDetails, isPurchasablePlan } from "terse-types"

import { stripe } from "./settings"

export { PlanKey, SupportedTopUps, TimePeriods, getPlanByPriceId, getPlanDetails, isPurchasablePlan }

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
