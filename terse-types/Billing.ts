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

export type BillingContextResponse = {
    balance: BalanceSummary
    usage: UsageResponse
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
export const DEFAULT_OVERAGE_CAP_MULTIPLIER = 2
export const DEFAULT_OVERAGE_MODE: OverageMode = "strict"

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
}

export enum SupportedTopUps {
    TOPUP_10K = 10000
}

export type TopUp = {
    credits: SupportedTopUps
    priceInUsd: number
    priceId: EnvId
}

export function isPurchasablePlan(plan: Plan): boolean {
    return !!(plan.monthlyBasePriceId || plan.annualBasePriceId)
}

export type BillingCatalogResponse = {
    plans: Plan[]
    topUps: TopUp[]
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
