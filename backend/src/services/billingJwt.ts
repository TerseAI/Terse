import { SignJWT, jwtVerify } from "jose"
import {
    BILLING_SERVICE_CALLBACK_JWT_AUDIENCE,
    BILLING_SERVICE_CALLBACK_JWT_ISSUER,
    BILLING_SERVICE_JWT_AUDIENCE,
    BILLING_SERVICE_JWT_ISSUER,
    terseBillingJwtClaimsSchema,
    type TerseBillingJwtClaims
} from "terse-types"

import { settings } from "../config/settings"

const BILLING_JWT_MAX_AGE_SEC = 300

export async function signTerseBillingJwt(claims: TerseBillingJwtClaims): Promise<string> {
    const secret = settings.billing.jwtSecret?.trim()
    if (!secret) {
        throw new Error("BILLING_JWT_SECRET is not configured")
    }
    const key = new TextEncoder().encode(secret)
    const body: TerseBillingJwtClaims = {
        organizationId: claims.organizationId
    }
    return new SignJWT(body)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${BILLING_JWT_MAX_AGE_SEC}s`)
        .setIssuer(BILLING_SERVICE_JWT_ISSUER)
        .setAudience(BILLING_SERVICE_JWT_AUDIENCE)
        .sign(key)
}

export async function verifyBillingServiceCallbackJwt(token: string): Promise<TerseBillingJwtClaims> {
    const secret = settings.billing.jwtSecret?.trim()
    if (!secret) {
        throw new Error("BILLING_JWT_SECRET is not configured")
    }
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key, {
        issuer: BILLING_SERVICE_CALLBACK_JWT_ISSUER,
        audience: BILLING_SERVICE_CALLBACK_JWT_AUDIENCE,
        algorithms: ["HS256"]
    })
    return terseBillingJwtClaimsSchema.parse(payload)
}
