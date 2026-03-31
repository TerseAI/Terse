import { Request, Response } from "express"
import { jwtVerify } from "jose"

import logger from "../logger"
import { db } from "../prismaClient"
import { DeviceTokenExchangeResponse } from "../shared/types"
import { createApiToken } from "../utility/apiTokens"
import { FeatureFlag, FeatureFlagService } from "../utility/featureFlags"
import { workos } from "../utility/workos"

const featureFlagService = FeatureFlagService.getInstance()

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
        const jwks = await workos.userManagement.getJWKS()
        if (!jwks) {
            return res.status(500).json({ error: "Could not fetch JWKS for token verification" })
        }

        const { payload } = await jwtVerify(accessToken, jwks)
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

        // Fetch user details for the feature flag check and response
        const workosUser = await workos.userManagement.getUser(workosUserId)

        // Check SDK feature flag
        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) {
            return res.status(403).json({ error: "SDK interface is not enabled for your account" })
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
        logger.error("[device-token-exchange] Failed to exchange token", { error })

        if (error?.code === "ERR_JWT_EXPIRED" || error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
            return res.status(401).json({ error: "Invalid or expired access token" })
        }

        return res.status(500).json({ error: "Failed to exchange token" })
    }
}
