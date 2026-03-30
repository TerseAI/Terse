import { Request, Response } from "express"
import { decodeJwt, jwtVerify } from "jose"

import logger from "../logger"
import { db } from "../prismaClient"
import { DeviceTokenExchangeResponse } from "../shared/types"
import { createApiToken } from "../utility/apiTokens"
import { workos } from "../utility/workos"

/**
 * POST /sdk/auth/device-token-exchange
 *
 * Accepts a WorkOS access token (JWT from the device authorization flow),
 * verifies it via JWKS, looks up the user, creates a Terse API token,
 * and returns it.
 *
 * No auth middleware required — the WorkOS JWT in the body IS the auth.
 */
export async function deviceTokenExchange(req: Request, res: Response) {
    const { accessToken } = req.body

    if (!accessToken || typeof accessToken !== "string") {
        return res.status(400).json({ error: "accessToken is required" })
    }

    try {
        // Decode the JWT without verification first to inspect it
        const decoded = decodeJwt(accessToken)
        logger.info("[device-token-exchange] Decoded JWT payload", {
            sub: decoded.sub,
            iss: decoded.iss,
            aud: decoded.aud,
            exp: decoded.exp,
            iat: decoded.iat,
            kid: decoded.kid,
            allClaims: Object.keys(decoded)
        })

        // Also log the JWT header
        const [headerB64] = accessToken.split(".")
        const header = JSON.parse(Buffer.from(headerB64, "base64url").toString())
        logger.info("[device-token-exchange] JWT header", { header })

        // Fetch JWKS and log what keys are available
        const jwks = await workos.userManagement.getJWKS()
        // Access the internal JWKS data to see the actual key IDs
        const jwksData = (jwks as any)?.jwks?.keys || (jwks as any)?.keys || []
        const keyIds = Array.isArray(jwksData) ? jwksData.map((k: any) => ({ kid: k.kid, alg: k.alg, kty: k.kty })) : []
        logger.info("[device-token-exchange] JWKS fetched", {
            hasJwks: !!jwks,
            type: typeof jwks,
            internalKeys: Object.keys(jwks || {}),
            keyIds,
            jwtKid: header.kid
        })

        // Also fetch the raw JWKS URL to compare
        try {
            const rawJwksRes = await fetch(`https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`)
            const rawJwks = await rawJwksRes.json() as { keys?: Array<{ kid: string; alg: string }> }
            const rawKeyIds = rawJwks.keys?.map(k => ({ kid: k.kid, alg: k.alg })) || []
            logger.info("[device-token-exchange] Raw JWKS from WorkOS", { rawKeyIds })
        } catch (e) {
            logger.warn("[device-token-exchange] Failed to fetch raw JWKS", { error: e })
        }

        if (!jwks) {
            return res.status(500).json({ error: "Could not fetch JWKS for token verification" })
        }

        logger.info("[device-token-exchange] Attempting jwtVerify")
        const { payload } = await jwtVerify(accessToken, jwks)
        logger.info("[device-token-exchange] jwtVerify succeeded", { sub: payload.sub })

        const workosUserId = payload.sub as string
        if (!workosUserId) {
            return res.status(401).json({ error: "Invalid access token: missing subject" })
        }

        // Find the user in our database by WorkOS ID
        const prisma = db()
        const dbUser = await prisma.users.findUnique({
            where: { workos_id: workosUserId }
        })

        if (!dbUser) {
            return res.status(404).json({
                error: "User not found. Please sign up at the Terse web app first."
            })
        }

        // Get the user's organization from the JWT or fall back to membership lookup
        let organizationId = payload.org_id as string | undefined
        if (!organizationId) {
            const memberships = await workos.userManagement.listOrganizationMemberships({
                userId: workosUserId,
                statuses: ["active"]
            })
            organizationId = memberships.data[0]?.organizationId
        }

        if (!organizationId) {
            return res.status(403).json({
                error: "User has no organization. Please create or join an organization first."
            })
        }

        // Fetch user details for the response
        const workosUser = await workos.userManagement.getUser(workosUserId)

        // Create an API token for CLI use
        const { rawToken } = await createApiToken(dbUser.id, organizationId, "CLI Login")

        const displayName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || null

        const response: DeviceTokenExchangeResponse = {
            apiKey: rawToken,
            user: {
                email: workosUser.email,
                firstName: workosUser.firstName || null,
                displayName
            }
        }

        return res.status(201).json(response)
    } catch (error: any) {
        logger.error("[device-token-exchange] Failed to exchange token", {
            error,
            errorName: error?.name,
            errorCode: error?.code,
            errorMessage: error?.message,
            stack: error?.stack
        })

        if (error?.code === "ERR_JWT_EXPIRED" || error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
            return res.status(401).json({ error: "Invalid or expired access token" })
        }

        return res.status(500).json({ error: "Failed to exchange token" })
    }
}
