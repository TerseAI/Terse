import { z } from "zod"

import billingRoutes from "./BillingRoutes.json" with { type: "json" }
import { modelReferenceSchema } from "./ModelRegistry"

export enum PlanKey {
    FREE = "free",
    PRO = "pro"
}

export const planKeySchema = z.enum(PlanKey)

export enum TimePeriods {
    MONTHLY = "monthly",
    YEARLY = "yearly"
}

export const billingPeriodSchema = z.enum(TimePeriods)
export type BillingPeriod = z.infer<typeof billingPeriodSchema>

export enum SupportedTopUps {
    TOPUP_10K = 10000
}

export const supportedTopUpsSchema = z.enum(SupportedTopUps)

export const envIdSchema = z.object({
    live: z.string(),
    test: z.string()
})
export type EnvId = z.infer<typeof envIdSchema>

export const overageModeSchema = z.enum(["soft", "strict"])
export type OverageMode = z.infer<typeof overageModeSchema>

export const DEFAULT_OVERAGE_CAP_MULTIPLIER = 2
export const DEFAULT_OVERAGE_MODE: OverageMode = "strict"

export const billingScheduledChangeSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("cancel_to_free"),
        effectiveAt: z.coerce.date()
    }),
    z.object({
        kind: z.literal("change_period"),
        effectiveAt: z.coerce.date(),
        period: billingPeriodSchema
    })
])
export type BillingScheduledChange = z.infer<typeof billingScheduledChangeSchema>

export const balanceSummarySchema = z.object({
    planKey: planKeySchema,
    billingPeriod: billingPeriodSchema.nullable(),
    planCredits: z.number(),
    consumedCredits: z.number(),
    topUpCredits: z.number(),
    totalCreditCapacity: z.number(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    overageMode: overageModeSchema,
    hardCap: z.number(),
    canBuyTopups: z.boolean(),
    scheduledChange: billingScheduledChangeSchema.nullable()
})
export type BalanceSummary = z.infer<typeof balanceSummarySchema>

export const usageBucketSchema = z.object({
    startTimestamp: z.number(),
    endTimestamp: z.number(),
    credits: z.number()
})
export type UsageBucket = z.infer<typeof usageBucketSchema>

export const usageResponseSchema = z.object({
    buckets: z.array(usageBucketSchema)
})
export type UsageResponse = z.infer<typeof usageResponseSchema>

export const billingContextResponseSchema = z.object({
    balance: balanceSummarySchema,
    usage: usageResponseSchema
})
export type BillingContextResponse = z.infer<typeof billingContextResponseSchema>

export const completedEventUsageSchema = z.object({
    inputTokens: z.number().nonnegative(),
    outputTokens: z.number().nonnegative(),
    totalTokens: z.number().nonnegative(),
    inputTokensDetails: z.object({
        cached_tokens: z.number().nonnegative()
    })
})
export type CompletedEventUsage = z.infer<typeof completedEventUsageSchema>

export const billingRunGateRequestBodySchema = z.object({
    organizationId: z.string().min(1),
    email: z.email().optional()
})
export type BillingRunGateRequestBody = z.infer<typeof billingRunGateRequestBodySchema>

export const billingChargeRunBaseBodySchema = billingRunGateRequestBodySchema.extend({
    runId: z.string().min(1)
})
export type BillingChargeRunBaseBody = z.infer<typeof billingChargeRunBaseBodySchema>

export const billingRecordLlmBodySchema = z.object({
    organizationId: z.string().min(1),
    runId: z.string().min(1),
    responseId: z.string().min(1),
    model: modelReferenceSchema,
    usage: completedEventUsageSchema
})
export type BillingRecordLlmBody = z.infer<typeof billingRecordLlmBodySchema>

export const billingRecordLlmPayloadSchema = billingRecordLlmBodySchema.pick({
    responseId: true,
    model: true,
    usage: true
})
export type BillingRecordLlmPayload = z.infer<typeof billingRecordLlmPayloadSchema>

export const billingCacheInvalidationBodySchema = z.object({
    organizationId: z.string().min(1)
})
export type BillingCacheInvalidationBody = z.infer<typeof billingCacheInvalidationBodySchema>

export const billingCheckoutPlanBodySchema = z.object({
    kind: z.literal("plan"),
    planKey: planKeySchema,
    period: billingPeriodSchema
})
export type BillingCheckoutPlanBody = z.infer<typeof billingCheckoutPlanBodySchema>

export const billingCheckoutTopupBodySchema = z.object({
    kind: z.literal("topup"),
    packCredits: supportedTopUpsSchema
})
export type BillingCheckoutTopupBody = z.infer<typeof billingCheckoutTopupBodySchema>

export const billingCheckoutRequestBodySchema = z.discriminatedUnion("kind", [billingCheckoutPlanBodySchema, billingCheckoutTopupBodySchema])
export type BillingCheckoutRequestBody = z.infer<typeof billingCheckoutRequestBodySchema>

export const billingChangeCancelBodySchema = z.object({ kind: z.literal("cancel_to_free") })
export const billingChangePeriodBodySchema = z.object({
    kind: z.literal("change_period"),
    planKey: planKeySchema,
    period: billingPeriodSchema
})

export const billingChangeRequestBodySchema = z.discriminatedUnion("kind", [billingChangeCancelBodySchema, billingChangePeriodBodySchema])
export type BillingChangeRequestBody = z.infer<typeof billingChangeRequestBodySchema>

export const billingOverageModePatchBodySchema = z.object({
    mode: overageModeSchema
})
export type BillingOverageModePatchBody = z.infer<typeof billingOverageModePatchBodySchema>

export const billingPortalSessionRequestBodySchema = z.object({}).strict()
export type BillingPortalSessionRequestBody = z.infer<typeof billingPortalSessionRequestBodySchema>

export const billingContextQuerySchema = z.object({
    start: z.string().min(1).optional(),
    end: z.string().min(1).optional()
})
export type BillingContextQuery = z.infer<typeof billingContextQuerySchema>

export const getOrCreateCustomerRequestBodySchema = z.object({}).strict()
export type GetOrCreateCustomerRequestBody = z.infer<typeof getOrCreateCustomerRequestBodySchema>

export const billingStripeRedirectResponseSchema = z.object({
    url: z.string()
})
export type BillingStripeRedirectResponse = z.infer<typeof billingStripeRedirectResponseSchema>

export const setOverageModeResponseSchema = z.object({
    ok: z.literal(true)
})
export type SetOverageModeResponse = z.infer<typeof setOverageModeResponseSchema>

export const billingChangeResponseSchema = z.object({
    ok: z.literal(true),
    scheduledChange: billingScheduledChangeSchema.nullable()
})
export type BillingChangeResponse = z.infer<typeof billingChangeResponseSchema>

export const runGateDenyReasonSchema = z.enum(["credits_exhausted", "subscription_past_due", "no_subscription"])
export type RunGateDenyReason = z.infer<typeof runGateDenyReasonSchema>

export const runGateAllowSchema = z.object({ allow: z.literal(true) })
export const runGateDenySchema = z.object({
    allow: z.literal(false),
    reason: runGateDenyReasonSchema
})

export const runGateDecisionSchema = z.discriminatedUnion("allow", [runGateAllowSchema, runGateDenySchema])
export type RunGateDecision = z.infer<typeof runGateDecisionSchema>

export function parseRunGateDenyReason(raw: unknown): RunGateDenyReason {
    const parsed = runGateDenyReasonSchema.safeParse(raw)
    return parsed.success ? parsed.data : "credits_exhausted"
}

export const getOrCreateCustomerResponseSchema = z.object({
    customerId: z.string()
})
export type GetOrCreateCustomerResponse = z.infer<typeof getOrCreateCustomerResponseSchema>

export const planSchema = z.object({
    key: planKeySchema,
    name: z.string(),
    monthlyBasePriceId: envIdSchema.nullable(),
    annualBasePriceId: envIdSchema.nullable(),
    overagePriceId: envIdSchema.nullable(),
    priceInUsdMonthly: z.number().nullable(),
    priceInUsdMonthlyAnnual: z.number().nullable(),
    includedCreditsPerMonth: z.number(),
    markupPct: z.number(),
    overageCentsPerCredit: z.number().nullable(),
    hardCapMultiplier: z.number(),
    defaultOverageMode: overageModeSchema
})
export type Plan = z.infer<typeof planSchema>

export function isPurchasablePlan(plan: Plan): boolean {
    return !!(plan.monthlyBasePriceId || plan.annualBasePriceId)
}

export const topUpSchema = z.object({
    credits: supportedTopUpsSchema,
    priceInUsd: z.number(),
    priceId: envIdSchema
})
export type TopUp = z.infer<typeof topUpSchema>

export const billingCatalogResponseSchema = z.object({
    plans: z.array(planSchema),
    topUps: z.array(topUpSchema)
})
export type BillingCatalogResponse = z.infer<typeof billingCatalogResponseSchema>

export const BILLING_SERVICE_JWT_ISSUER = "terse-api" as const
export const BILLING_SERVICE_JWT_AUDIENCE = "terse-billing" as const
export const BILLING_SERVICE_CALLBACK_JWT_ISSUER = "terse-billing" as const
export const BILLING_SERVICE_CALLBACK_JWT_AUDIENCE = "terse-api" as const

export const terseBillingJwtClaimsSchema = z.object({
    organizationId: z.string().min(1)
})
export type TerseBillingJwtClaims = z.infer<typeof terseBillingJwtClaimsSchema>

export const BillingRoutes = billingRoutes

export type BillingForbiddenErrorType = "CreditGateDeniedError" | "StripeError"

export type BillingForbiddenErrorBody = {
    type: BillingForbiddenErrorType
    reason?: string
}

export class CreditGateDeniedError extends Error {
    readonly reason: RunGateDenyReason
    constructor(reason: RunGateDenyReason) {
        super(`Credit gate denied: ${reason}`)
        this.name = "CreditGateDeniedError"
        this.reason = reason
    }
}

export class StripeError extends Error {
    readonly reason?: string
    constructor(message?: string, reason?: string) {
        super(message ?? reason ?? "Billing provider error")
        this.name = "StripeError"
        this.reason = reason
    }
}

export function billingErrorFromForbiddenBody(body: unknown): CreditGateDeniedError | StripeError | null {
    if (!body || typeof body !== "object") return null
    const o = body as Record<string, unknown>
    const t = o.type ?? o.errorType
    if (t === "CreditGateDeniedError") {
        return new CreditGateDeniedError(parseRunGateDenyReason(o.reason))
    }
    if (t === "StripeError") {
        const reason = typeof o.reason === "string" ? o.reason : undefined
        return new StripeError(reason, reason)
    }
    return null
}
/** Parse JSON body from a billing HTTP 403 response */

export function parseBillingForbiddenJson(raw: string): CreditGateDeniedError | StripeError | null {
    try {
        return billingErrorFromForbiddenBody(JSON.parse(raw))
    } catch {
        return null
    }
}
