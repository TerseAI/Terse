import axios from "axios"
import type { Request, Response } from "express"
import {
    BillingCatalogResponse,
    BillingChangeRequestBody,
    BillingChangeResponse,
    BillingChargeRunBaseBody,
    BillingCheckoutRequestBody,
    BillingContextQuery,
    BillingContextResponse,
    BillingOverageModePatchBody,
    BillingPortalSessionRequestBody,
    BillingRecordLlmBody,
    BillingRoutes,
    BillingRunGateRequestBody,
    BillingStripeRedirectResponse,
    GetOrCreateCustomerRequestBody,
    GetOrCreateCustomerResponse,
    RunGateDecision,
    SetOverageModeResponse,
    type TerseBillingJwtClaims,
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
    chargeRunBase(body: BillingChargeRunBaseBody): Promise<void>
    recordLLMCall(body: BillingRecordLlmBody): Promise<void>
}

/** Authenticated browser/API routes: JWT derives from the session user. */
export function billingServiceProxyForRequest(req: Request): BillingService {
    const user = req.session?.user as User | undefined
    if (!user?.organizationId) {
        throw new Error("Billing requires an authenticated session with organizationId")
    }
    return new BillingServiceProxy(settings.billing.url, {
        organizationId: user.organizationId
    })
}

export function billingServiceProxyForOrganization(organizationId: string): BillingService | undefined {
    const url = settings.billing.url?.trim()
    if (!url) return undefined
    return new BillingServiceProxy(url, { organizationId })
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

    private async jsonRequest<T>(
        path: string,
        options?: { method?: string; body?: string }
    ): Promise<T> {
        const trimmed = this.backendUrl?.trim()
        if (!trimmed) {
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
            transformResponse: [(data) => data]
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

        return JSON.parse(text) as T
    }

    async createCheckoutSession(body: BillingCheckoutRequestBody): Promise<BillingStripeRedirectResponse> {
        return this.jsonRequest<BillingStripeRedirectResponse>(BillingRoutes.CHECKOUT_SESSION, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    createBillingPortalSession(_body?: BillingPortalSessionRequestBody): Promise<BillingStripeRedirectResponse> {
        return this.jsonRequest<BillingStripeRedirectResponse>(BillingRoutes.PORTAL_SESSION, {
            method: "POST",
            body: JSON.stringify({} satisfies BillingPortalSessionRequestBody)
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
            body: JSON.stringify(body)
        })
    }

    async checkRunGate(body: BillingRunGateRequestBody): Promise<RunGateDecision> {
        return this.jsonRequest<RunGateDecision>(BillingRoutes.RUN_GATE, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    async chargeRunBase(body: BillingChargeRunBaseBody): Promise<void> {
        await this.jsonRequest<void>(BillingRoutes.CHARGE_RUN_BASE, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }

    async recordLLMCall(body: BillingRecordLlmBody): Promise<void> {
        await this.jsonRequest<void>(BillingRoutes.RECORD_LLM, {
            method: "POST",
            body: JSON.stringify(body)
        })
    }
}
