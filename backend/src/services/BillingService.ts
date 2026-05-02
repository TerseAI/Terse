import axios from "axios"
import type { Request, Response } from "express"
import {
    BillingCatalogResponse,
    BillingChangeRequestBody,
    BillingChangeResponse,
    BillingChargeRunBaseBody,
    BillingChargeRunBaseResponse,
    BillingCheckoutRequestBody,
    BillingContextQuery,
    BillingContextResponse,
    BillingOverageModePatchBody,
    BillingPortalSessionRequestBody,
    BillingRecordLlmBody,
    BillingRecordLlmResponse,
    BillingRoutes,
    BillingRunGateRequestBody,
    BillingStripeRedirectResponse,
    CreditGateDeniedError,
    DEFAULT_OVERAGE_CAP_MULTIPLIER,
    DEFAULT_OVERAGE_MODE,
    GetOrCreateCustomerRequestBody,
    GetOrCreateCustomerResponse,
    PlanKey,
    RunGateDecision,
    SetOverageModeResponse,
    StripeError,
    type TerseBillingJwtClaims,
    billingChargeRunBaseResponseSchema,
    billingRecordLlmResponseSchema,
    parseBillingForbiddenJson
} from "terse-types"
import type { User } from "terse-types/types"

import { settings } from "../config/settings"

import { signTerseBillingJwt } from "./billingJwt"

const BILLING_REQUEST_TIMEOUT_MS = 15_000

export class BillingNoBackendError extends Error {
    constructor() {
        super("Billing backend URL is not configured")
        this.name = "BillingNoBackendError"
    }
}

export type BillingProxyAuth = TerseBillingJwtClaims

export interface BillingService {
    createCheckoutSession(body: BillingCheckoutRequestBody): Promise<BillingStripeRedirectResponse>
    createBillingPortalSession(body?: BillingPortalSessionRequestBody): Promise<BillingStripeRedirectResponse>
    changeBillingSubscription(body: BillingChangeRequestBody): Promise<BillingChangeResponse>
    getBillingCatalog(): Promise<BillingCatalogResponse>
    getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse>
    setBillingOverageMode(body: BillingOverageModePatchBody): Promise<SetOverageModeResponse>
    getOrCreateCustomer(body?: GetOrCreateCustomerRequestBody): Promise<GetOrCreateCustomerResponse>
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
        organizationId: user.organizationId
    })
}

export function billingServiceProxyForOrganization(organizationId: string): BillingService {
    return billingServiceForOrganizationAuth({ organizationId })
}

function billingServiceForOrganizationAuth(auth: BillingProxyAuth): BillingService {
    const url = settings.billing.url?.trim()
    const secret = settings.billing.jwtSecret?.trim()
    if (!url || !secret) return new BillingNoOpService()
    return new BillingServiceProxy(url, auth)
}

export class BillingNoOpService implements BillingService {
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
                    overagePriceId: null,
                    priceInUsdMonthly: null,
                    priceInUsdMonthlyAnnual: null,
                    includedCreditsPerMonth: 0,
                    markupPct: 0,
                    overageCentsPerCredit: 0,
                    hardCapMultiplier: DEFAULT_OVERAGE_CAP_MULTIPLIER,
                    defaultOverageMode: DEFAULT_OVERAGE_MODE
                }
            ],
            topUps: []
        }
    }

    async getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse> {
        const { start, end } = noOpBillingWindow(query)
        return {
            balance: {
                planKey: PlanKey.FREE,
                billingPeriod: null,
                planCredits: 0,
                consumedCredits: 0,
                remainingCredits: 0,
                totalCreditCapacity: 0,
                periodStart: start,
                periodEnd: end,
                overageMode: DEFAULT_OVERAGE_MODE,
                hardCap: 0,
                canBuyTopups: false,
                scheduledChange: null
            },
            usage: {
                buckets: []
            }
        }
    }

    async setBillingOverageMode(): Promise<SetOverageModeResponse> {
        return { ok: true }
    }

    async getOrCreateCustomer(): Promise<GetOrCreateCustomerResponse> {
        return { customerId: "" }
    }

    async checkRunGate(): Promise<RunGateDecision> {
        return { allow: true }
    }

    async chargeRunBase(body: BillingChargeRunBaseBody): Promise<BillingChargeRunBaseResponse> {
        return { runId: body.runId, creditsCharged: 0 }
    }

    async recordLLMCall(body: BillingRecordLlmBody): Promise<BillingRecordLlmResponse> {
        return { responseId: body.responseId, creditsCharged: 0 }
    }
}

export class BillingServiceProxy implements BillingService {
    constructor(
        private readonly backendUrl: string | undefined,
        private readonly auth: BillingProxyAuth,
        private readonly extraHeaders?: Record<string, string | undefined>
    ) {}

    /**
     * Runs a billing service call and writes JSON to `res`, or sends 204 when no billing backend is configured.
     */
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
        if (!trimmed || !settings.billing.jwtSecret?.trim()) {
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
            throw new StripeError("Billing service returned invalid JSON")
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

    getBillingContext(query: BillingContextQuery): Promise<BillingContextResponse> {
        const params = new URLSearchParams()
        if (query.start) params.set("start", query.start)
        if (query.end) params.set("end", query.end)
        const qs = params.toString()
        return this.jsonRequest<BillingContextResponse>(`${BillingRoutes.CONTEXT}${qs ? `?${qs}` : ""}`, { method: "GET" })
    }

    setBillingOverageMode(body: BillingOverageModePatchBody): Promise<SetOverageModeResponse> {
        return this.jsonRequest<SetOverageModeResponse>(BillingRoutes.OVERAGE_MODE, {
            method: "PATCH",
            body: JSON.stringify(body)
        })
    }

    async getOrCreateCustomer(body?: GetOrCreateCustomerRequestBody): Promise<GetOrCreateCustomerResponse> {
        return this.jsonRequest<GetOrCreateCustomerResponse>(BillingRoutes.CUSTOMER, {
            method: "POST",
            body: JSON.stringify(body ?? {})
        })
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
            throw new StripeError("Billing service returned an empty charge-run-base response")
        }
        const parsed = billingChargeRunBaseResponseSchema.safeParse(raw)
        if (!parsed.success) {
            throw new StripeError("Billing service returned an invalid charge-run-base response")
        }
        return parsed.data
    }

    async recordLLMCall(body: BillingRecordLlmBody): Promise<BillingRecordLlmResponse> {
        const raw = await this.jsonRequest<unknown>(BillingRoutes.RECORD_LLM, {
            method: "POST",
            body: JSON.stringify(body)
        })
        if (raw === undefined) {
            throw new StripeError("Billing service returned an empty record-llm response")
        }
        const parsed = billingRecordLlmResponseSchema.safeParse(raw)
        if (!parsed.success) {
            throw new StripeError("Billing service returned an invalid record-llm response")
        }
        return parsed.data
    }
}

/**
 * Explicit run-start boundary: gate first, then optional base charge.
 * No-op when billing is not configured. Use `chargeBaseRun: false` for
 * resume paths where the base fee was already taken at initial start.
 */
export async function startBillingRun(billing: BillingService, params: { organizationId: string; runId: string; chargeBaseRun?: boolean }): Promise<void> {
    const gate = await billing.checkRunGate({ organizationId: params.organizationId })
    if (!gate.allow) {
        throw new CreditGateDeniedError(gate.reason)
    }

    if (params.chargeBaseRun === false) return

    await billing.chargeRunBase({
        organizationId: params.organizationId,
        runId: params.runId
    })
}

function noOpBillingWindow(query: BillingContextQuery): { start: Date; end: Date } {
    const now = new Date()
    const fallbackStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const fallbackEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    return {
        start: parseBillingDate(query.start) ?? fallbackStart,
        end: parseBillingDate(query.end) ?? fallbackEnd
    }
}

function parseBillingDate(raw: string | undefined): Date | null {
    if (!raw) return null
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
}
