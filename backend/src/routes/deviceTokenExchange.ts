import { Request, Response } from "express"
import { jwtVerify } from "jose"
import { DeviceTokenExchangeResponse } from "terse-types/types"
import { deviceTokenExchangeRequestSchema } from "terse-types/types"

import logger from "../logger"
import { getOrCreateCustomer } from "../services/PaymentsProviderService"
import { decodeAccessTokenClaims } from "../utility/accessTokenClaims"
import { createApiToken } from "../utility/apiTokens"
import { FeatureFlag, FeatureFlagService } from "../utility/featureFlags"
import { workos } from "../utility/workos"

import { getOrCreateDbUserFromWorkOS, setDefaultOrganizationMetadata } from "./auth"

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
    const { accessToken } = deviceTokenExchangeRequestSchema.parse(req.body)

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

        // Fetch user details from WorkOS
        const workosUser = await workos.userManagement.getUser(workosUserId)

        // Check SDK feature flag
        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) {
            return res.status(403).json({ error: "SDK interface is not enabled for your account" })
        }

        // Get the user's organization from the JWT or fall back to membership lookup
        let organizationId = payload.org_id as string | undefined
        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: workosUserId,
            statuses: ["active"]
        })
        if (!organizationId) {
            organizationId = memberships.data[0]?.organizationId
        }

        // If the user has no org, auto-create one for first-time SDK users
        let roles: string[] = []
        if (!organizationId) {
            const orgName = workosUser.firstName ? `${workosUser.firstName}'s Organization` : `${workosUser.email}'s Organization`
            const organization = await workos.organizations.createOrganization({ name: orgName })
            await workos.userManagement.createOrganizationMembership({
                organizationId: organization.id,
                userId: workosUserId,
                roleSlug: "admin"
            })
            organizationId = organization.id
            roles = ["admin"]

            // Create a Stripe customer for the organization
            const stripeCustomerId = await getOrCreateCustomer(organizationId)
            await setDefaultOrganizationMetadata(organizationId, stripeCustomerId)
        } else {
            const membership = memberships.data.find(m => m.organizationId === organizationId)
            roles = membership?.roles?.map(role => role.slug) ?? []
        }

        // Find or create the user in our database
        const claims = decodeAccessTokenClaims(accessToken)
        const { user: dbUser } = await getOrCreateDbUserFromWorkOS({ user: workosUser, organizationId, roles }, claims)

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
