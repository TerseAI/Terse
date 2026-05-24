import { Request, Response } from "express"
import { JWTPayload } from "jose"
import {
    DeviceTokenExchangeResponse,
    IdentifyResponse,
    SdkOrganizationsListResponse,
    SwitchOrganizationResponse,
    deviceTokenExchangeRequestSchema,
    identifyRequestSchema,
    switchOrganizationRequestSchema
} from "terse-types/types"
import { ZodError } from "zod"

import { FeatureFlag, FeatureFlagService } from "../../../common/featureFlags"
import logger from "../../../common/logger"
import { createApiToken } from "../../../modules/auth/helpers/apiTokens"
import { getAuthProvider } from "../../../services/authProvider"
import { AuthTokenError } from "../../../services/authProvider/AuthProvider"
import { getOrganizationProvider } from "../../../services/organizationProvider"

const featureFlagService = FeatureFlagService.getInstance()

const CLI_LOGIN_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
function cliLoginExpiry(): Date {
    return new Date(Date.now() + CLI_LOGIN_TOKEN_TTL_MS)
}

async function verifyUserAccessToken(accessToken: string): Promise<{ userId: string }> {
    const payload = await getAuthProvider().verifyJWT(accessToken)
    const userId = payload.sub as string | undefined
    if (!userId) throw new AuthTokenError(401, "Invalid access token: missing subject")
    return { userId }
}

function handleVerifyError(error: any, res: Response, route: string): Response | null {
    if (error instanceof AuthTokenError) return res.status(error.status).json({ error: error.message })
    if (error?.code === "ERR_JWT_EXPIRED" || error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
        return res.status(401).json({ error: "Invalid or expired access token" })
    }
    logger.error(`[${route}] Unexpected error`, { error })
    return null
}

export async function identify(req: Request, res: Response) {
    try {
        const { accessToken } = identifyRequestSchema.parse(req.body)
        const { userId } = await verifyUserAccessToken(accessToken)
        const user = await getAuthProvider().getUser(userId)

        if (!user) return res.status(401).json({ error: "Unauthorized" })

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, user.email, { email: user.email })
        if (!isSdkEnabled) return res.status(403).json({ error: "SDK interface is not enabled for your account" })

        const memberships = await getOrganizationProvider().getMemberships(userId)

        const orgs = memberships.map(m => ({ id: m.organizationId, name: m.organizationName, roles: m.roles }))
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null

        const response: IdentifyResponse = {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                displayName
            },
            organizations: orgs
        }

        return res.status(200).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        const handled = handleVerifyError(error, res, "identify")
        if (handled) return handled
        return res.status(500).json({ error: "Failed to identify user" })
    }
}

export async function deviceTokenExchange(req: Request, res: Response) {
    try {
        const { accessToken, organizationId } = deviceTokenExchangeRequestSchema.parse(req.body)
        const { userId } = await verifyUserAccessToken(accessToken)
        const user = await getAuthProvider().getUser(userId)
        if (!user) return res.status(401).json({ error: "Unauthorized" })

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, user.email, { email: user.email })
        if (!isSdkEnabled) return res.status(403).json({ error: "SDK interface is not enabled for your account" })

        const memberships = await getOrganizationProvider().getMemberships(userId)
        const membership = memberships.find(m => m.organizationId === organizationId)
        if (!membership) return res.status(403).json({ error: "You are not a member of that organization" })

        const { rawToken } = await createApiToken(userId, organizationId, "CLI Login", { expiresAt: cliLoginExpiry() })

        const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null

        const response: DeviceTokenExchangeResponse = {
            apiKey: rawToken,
            user: { email: user.email, firstName: user.firstName || null, displayName },
            organization: { id: membership.organizationId, name: membership.organizationName }
        }

        return res.status(201).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        const handled = handleVerifyError(error, res, "device-token-exchange")
        if (handled) return handled
        return res.status(500).json({ error: "Failed to exchange token" })
    }
}

export async function listMyOrganizations(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    try {
        const memberships = await getOrganizationProvider().getMemberships(user.id)
        const organizations = memberships.map(m => ({ id: m.organizationId, name: m.organizationName }))
        const response: SdkOrganizationsListResponse = { organizations, activeOrganizationId: user.organizationId }
        return res.json(response)
    } catch (error: any) {
        logger.error("[me/organizations] Failed", { error, userId: user.id })
        return res.status(500).json({ error: "Failed to list organizations" })
    }
}

export async function switchOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    try {
        const { organizationId } = switchOrganizationRequestSchema.parse(req.body)
        const memberships = await getOrganizationProvider().getMemberships(user.id)
        const membership = memberships.find(m => m.organizationId === organizationId)
        if (!membership) return res.status(403).json({ error: "You are not a member of that organization" })

        const { rawToken } = await createApiToken(user.id, organizationId, "CLI Login", { expiresAt: cliLoginExpiry() })

        const response: SwitchOrganizationResponse = {
            apiKey: rawToken,
            organization: { id: membership.organizationId, name: membership.organizationName }
        }
        return res.status(201).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        logger.error("[switch-organization] Failed", { error, userId: user.id })
        return res.status(500).json({ error: "Failed to switch organization" })
    }
}

// /sdk/me — returns the active user from session, refreshed from WorkOS
export async function sdkMe(req: Request, res: Response) {
    getAuthProvider().me(req, res)
}
