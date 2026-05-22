import axios from "axios"
import type { Request, Response } from "express"
import { DateTime } from "luxon"
import {
    BillingCatalogResponse,
    BillingChangeRequestBody,
    BillingChangeResponse,
    BillingChargeRunBaseBody,
    BillingChargeRunBaseResponse,
    BillingCheckoutRequestBody,
    BillingContextQuery,
    BillingContextResponse,
    BillingError,
    BillingPortalSessionRequestBody,
    BillingRecordLlmBody,
    BillingRecordLlmResponse,
    BillingRoutes,
    BillingRunGateRequestBody,
    BillingStatusResponse,
    BillingStripeRedirectResponse,
    BillingUsageBucketsQuery,
    CreditGateDeniedError,
    PlanKey,
    RunGateDecision,
    type TerseBillingJwtClaims,
    type UsageResponse,
    billingChargeRunBaseResponseSchema,
    billingRecordLlmResponseSchema,
    parseBillingForbiddenJson
} from "terse-types"
import type { User } from "terse-types/types"

import { settings } from "../settings"

import { signTerseBillingJwt } from "./billingJwt"

const BILLING_REQUEST_TIMEOUT_MS = 15_000

class BillingNoBackendError extends Error {
    constructor() {
        super("Billing backend URL is not configured")
        this.name = "BillingNoBackendError"
    }
}

type BillingProxyAuth = TerseBillingJwtClaims

export interface BillingService {
    createCheckoutSession(body: BillingCheckoutRequestBody): Promise<BillingStripeRedirectResponse>
    createBillingPortalSession(body?: BillingPortalSessionRequestBody): Promise<BillingStripeRedirectResponse>
    changeBillingSubscription(body: BillingChangeRequestBody): Promise<BillingChangeResponse>
    getBillingCatalog(): Promise<BillingCatalogResponse>
    getBillingStatus(): Promise<BillingStatusResponse>
    getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse>
    getBillingUsageBuckets(query: BillingUsageBucketsQuery): Promise<UsageResponse>
    checkRunGate(body: BillingRunGateRequestBody): Promise<RunGateDecision>
    chargeRunBase(body: BillingChargeRunBaseBody): Promise<BillingChargeRunBaseResponse>
    recordLLMCall(body: BillingRecordLlmBody): Promise<BillingRecordLlmResponse>
}

/** Authenticated browser/API routes: JWT derives from the session user. */
export function billingServiceProxyForRequest(req: Request): BillingService {
    const user = req.session?.user as User | undefined
    if (!user?.organizationId) {
        throw new Error("Billing requires an authenticated session with organizationId")
    }
    return billingServiceForOrganizationAuth({
        organizationId: user.organizationId,
        userId: user.workosId
    })
}

export function billingServiceProxyForOrganization(organizationId: string, userId: string): BillingService {
    return billingServiceForOrganizationAuth({ organizationId, userId: userId })
}

function billingServiceForOrganizationAuth(auth: BillingProxyAuth): BillingService {
    if (!settings.billing.enabled) return new BillingNoOpService()
    const url = settings.billing.url?.trim()
    const secret = settings.billing.jwtSecret?.trim()
    if (!url || !secret) {
        throw new BillingNoBackendError()
    }
    return new BillingServiceProxy(url, auth)
}

class BillingNoOpService implements BillingService {
    async createCheckoutSession(): Promise<BillingStripeRedirectResponse> {
        return { url: settings.urls.frontend }
    }

    async createBillingPortalSession(): Promise<BillingStripeRedirectResponse> {
        return { url: settings.urls.frontend }
    }

    async changeBillingSubscription(): Promise<BillingChangeResponse> {
        return { ok: true, scheduledChange: null }
    }

    async getBillingCatalog(): Promise<BillingCatalogResponse> {
        return {
            plans: [
                {
                    key: PlanKey.FREE,
                    name: "Free",
                    monthlyBasePriceId: null,
                    annualBasePriceId: null,
                    priceInUsdMonthly: null,
                    priceInUsdMonthlyAnnual: null,
                    includedCreditsPerMonth: 0
                }
            ],
            topUps: []
        }
    }

    async getBillingStatus(): Promise<BillingStatusResponse> {
        return {
            billingEnabled: settings.billing.enabled,
            hasStripeCustomer: false,
            hasActivePaidSubscription: false,
            canManageBilling: false,
            planKey: PlanKey.FREE
        }
    }

    async getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse> {
        const start = query.start ?? DateTime.now().setZone(query.timezone).minus({ days: 30 }).startOf("day").toJSDate()
        const end = query.end ?? DateTime.now().setZone(query.timezone).plus({ days: 1 }).startOf("day").toJSDate()
        return {
            billingEnabled: settings.billing.enabled,
            balance: {
                planKey: PlanKey.FREE,
                billingPeriod: null,
                planCredits: 0,
                consumedCredits: 0,
                remainingCredits: 0,
                totalCreditCapacity: 0,
                periodStart: start,
                periodEnd: end,
                hardCap: 0,
                canBuyTopups: false,
                scheduledChange: null
            }
        }
    }

    async getBillingUsageBuckets(_query: BillingUsageBucketsQuery): Promise<UsageResponse> {
        return { buckets: [] }
    }

    async checkRunGate(): Promise<RunGateDecision> {
        return { allow: true }
    }

    async chargeRunBase(body: BillingChargeRunBaseBody): Promise<BillingChargeRunBaseResponse> {
        return { runId: body.runId }
    }

    async recordLLMCall(body: BillingRecordLlmBody): Promise<BillingRecordLlmResponse> {
        return { responseId: body.responseId }
    }
}

export class BillingServiceProxy implements BillingService {
    constructor(
        private readonly backendUrl: string | undefined,
        private readonly auth: BillingProxyAuth,
        private readonly extraHeaders?: Record<string, string | undefined>
    ) {}

    static async respondJson<T>(res: Response, work: Promise<T>): Promise<void> {
        try {
            res.json(await work)
        } catch (e) {
            if (e instanceof BillingNoBackendError) {
                res.status(204).end()
                return
            }
            throw e
        }
    }

    private async jsonRequest<T>(path: string, options?: { method?: string; body?: string }): Promise<T> {
        const trimmed = this.backendUrl?.trim()
        if (!settings.billing.enabled || !trimmed || !settings.billing.jwtSecret?.trim()) {
            throw new BillingNoBackendError()
        }
        const base = trimmed.replace(/\/$/, "")
        const headers: Record<string, string> = {}
        if (options?.body != null) {
            headers["Content-Type"] = "application/json"
        }
        const token = await signTerseBillingJwt(this.auth)
        headers["Authorization"] = `Bearer ${token}`
        if (this.extraHeaders) {
            for (const [k, v] of Object.entries(this.extraHeaders)) {
                if (v != null) headers[k] = v
            }
        }

        const method = (options?.method ?? "GET").toUpperCase()

        const response = await axios.request<string>({
            url: `${base}${path}`,
            method,
            ...(options?.body != null ? { data: options.body } : {}),
            headers,
            timeout: BILLING_REQUEST_TIMEOUT_MS,
            validateStatus: () => true,
            responseType: "text",
            transformResponse: [data => data]
        })

        const text = response.data ?? ""

        if (response.status < 200 || response.status >= 300) {
            if (response.status === 403) {
                const forbidden = parseBillingForbiddenJson(text)
                if (forbidden) throw forbidden
            }
            throw new Error(`Billing request failed (${response.status}): ${text || response.statusText}`)
        }

        if (!text) {
            return undefined as T
        }

        try {
            return JSON.parse(text) as T
        } catch {
            throw new BillingError("Billing service returned invalid JSON")
        }
    }

    async createCheckoutSession(body: BillingCheckoutRequestBody): Promise<BillingStripeRedirectResponse> {
        return this.jsonRequest<BillingStripeRedirectResponse>(BillingRoutes.CHECKOUT_SESSION, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    createBillingPortalSession(body?: BillingPortalSessionRequestBody): Promise<BillingStripeRedirectResponse> {
        return this.jsonRequest<BillingStripeRedirectResponse>(BillingRoutes.PORTAL_SESSION, {
            method: "POST",
            body: JSON.stringify(body ?? ({} satisfies BillingPortalSessionRequestBody))
        })
    }

    changeBillingSubscription(body: BillingChangeRequestBody): Promise<BillingChangeResponse> {
        return this.jsonRequest<BillingChangeResponse>(BillingRoutes.CHANGE, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    getBillingCatalog(): Promise<BillingCatalogResponse> {
        return this.jsonRequest<BillingCatalogResponse>(BillingRoutes.CATALOG, { method: "GET" })
    }

    getBillingStatus(): Promise<BillingStatusResponse> {
        return this.jsonRequest<BillingStatusResponse>(BillingRoutes.STATUS, { method: "GET" })
    }

    getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse> {
        const params = new URLSearchParams()
        if (query.start != null) params.set("start", query.start.toISOString())
        if (query.end != null) params.set("end", query.end.toISOString())
        params.set("timezone", query.timezone)
        const qs = params.toString()
        return this.jsonRequest<BillingContextResponse>(`${BillingRoutes.CONTEXT}${qs ? `?${qs}` : ""}`, { method: "GET" })
    }

    getBillingUsageBuckets(query: BillingUsageBucketsQuery): Promise<UsageResponse> {
        const params = new URLSearchParams()
        if (query.start != null) params.set("start", query.start.toISOString())
        if (query.end != null) params.set("end", query.end.toISOString())
        params.set("timezone", query.timezone)
        const qs = params.toString()
        return this.jsonRequest<UsageResponse>(`${BillingRoutes.USAGE_BUCKETS}${qs ? `?${qs}` : ""}`, { method: "GET" })
    }

    async checkRunGate(body: BillingRunGateRequestBody): Promise<RunGateDecision> {
        return this.jsonRequest<RunGateDecision>(BillingRoutes.RUN_GATE, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    async chargeRunBase(body: BillingChargeRunBaseBody): Promise<BillingChargeRunBaseResponse> {
        const raw = await this.jsonRequest<unknown>(BillingRoutes.CHARGE_RUN_BASE, {
            method: "POST",
            body: JSON.stringify(body)
        })
        if (raw === undefined) {
            throw new BillingError("Billing service returned an empty charge-run-base response")
        }
        const parsed = billingChargeRunBaseResponseSchema.safeParse(raw)
        if (!parsed.success) {
            throw new BillingError("Billing service returned an invalid charge-run-base response")
        }
        return parsed.data
    }

    async recordLLMCall(body: BillingRecordLlmBody): Promise<BillingRecordLlmResponse> {
        const raw = await this.jsonRequest<unknown>(BillingRoutes.RECORD_LLM, {
            method: "POST",
            body: JSON.stringify(body)
        })
        if (raw === undefined) {
            throw new BillingError("Billing service returned an empty record-llm response")
        }
        const parsed = billingRecordLlmResponseSchema.safeParse(raw)
        if (!parsed.success) {
            throw new BillingError("Billing service returned an invalid record-llm response")
        }
        return parsed.data
    }
}

/**
 * Explicit run-start boundary: gate first, then optional base charge.
 * No-op when billing is not configured.
 */
export async function startBillingRun(billing: BillingService, params: { organizationId: string; runId: string }): Promise<void> {
    const gate = await billing.checkRunGate({ organizationId: params.organizationId, breakCache: true })
    if (!gate.allow) {
        throw new CreditGateDeniedError(gate.reason)
    }

    await billing.chargeRunBase({
        organizationId: params.organizationId,
        runId: params.runId,
        breakCache: true
    })
}
