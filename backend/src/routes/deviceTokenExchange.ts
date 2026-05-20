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

import logger from "../logger"
import { getClaimsFromVerifiedPayload } from "../utility/accessTokenClaims"
import { createApiToken } from "../utility/apiTokens"
import { FeatureFlag, FeatureFlagService } from "../utility/featureFlags"
import { workos } from "../utility/workos"
import { WorkosTokenError, verifyWorkosJwt } from "../utility/workosJwt"

import { getOrCreateDbUserFromWorkOS } from "./auth"

const featureFlagService = FeatureFlagService.getInstance()

async function verifyWorkosAccessToken(accessToken: string): Promise<{ payload: JWTPayload; workosUserId: string }> {
    const payload = await verifyWorkosJwt(accessToken)
    const workosUserId = payload.sub as string | undefined
    if (!workosUserId) {
        throw new WorkosTokenError(401, "Invalid access token: missing subject")
    }
    return { payload, workosUserId }
}

function handleVerifyError(error: any, res: Response, route: string): Response | null {
    if (error instanceof WorkosTokenError) {
        return res.status(error.status).json({ error: error.message })
    }
    if (error?.code === "ERR_JWT_EXPIRED" || error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
        return res.status(401).json({ error: "Invalid or expired access token" })
    }
    logger.error(`[${route}] Unexpected error`, { error })
    return null
}

/**
 * POST /sdk/auth/identify
 *
 * Verifies a WorkOS device-code JWT and returns the user's profile plus the
 * list of organizations they are an active member of. Does NOT issue a Terse
 * API key and does NOT auto-create an org — the CLI uses this to poll while
 * the user finishes the org-creation form in the web app.
 */
export async function identify(req: Request, res: Response) {
    try {
        const { accessToken } = identifyRequestSchema.parse(req.body)
        const { workosUserId } = await verifyWorkosAccessToken(accessToken)
        const workosUser = await workos.userManagement.getUser(workosUserId)

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) {
            return res.status(403).json({ error: "SDK interface is not enabled for your account" })
        }

        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: workosUserId,
            statuses: ["active"]
        })

        const orgs = memberships.data.map(m => ({
            id: m.organizationId,
            name: m.organizationName,
            roles: m.roles?.map(r => r.slug) ?? []
        }))

        const displayName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || null

        const response: IdentifyResponse = {
            user: {
                workosId: workosUser.id,
                email: workosUser.email,
                firstName: workosUser.firstName || null,
                lastName: workosUser.lastName || null,
                displayName
            },
            organizations: orgs
        }

        return res.status(200).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        }
        const handled = handleVerifyError(error, res, "identify")
        if (handled) return handled
        return res.status(500).json({ error: "Failed to identify user" })
    }
}

/**
 * POST /sdk/auth/device-token-exchange
 *
 * Exchanges a verified WorkOS access token plus a chosen organizationId for a
 * Terse API key scoped to that org. The user must already be an active member
 * of organizationId — org creation happens in the web UI via the
 * /app/organizations/create flow.
 */
export async function deviceTokenExchange(req: Request, res: Response) {
    try {
        const { accessToken, organizationId } = deviceTokenExchangeRequestSchema.parse(req.body)
        const { payload, workosUserId } = await verifyWorkosAccessToken(accessToken)
        const workosUser = await workos.userManagement.getUser(workosUserId)

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) {
            return res.status(403).json({ error: "SDK interface is not enabled for your account" })
        }

        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: workosUserId,
            statuses: ["active"]
        })
        const membership = memberships.data.find(m => m.organizationId === organizationId)
        if (!membership) {
            return res.status(403).json({ error: "You are not a member of that organization" })
        }
        const roles = membership.roles?.map(r => r.slug) ?? []

        const claims = getClaimsFromVerifiedPayload(payload)
        const { user: dbUser } = await getOrCreateDbUserFromWorkOS({ user: workosUser, organizationId, roles }, claims)

        const { rawToken } = await createApiToken(dbUser.id, organizationId, "CLI Login")

        const displayName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || null

        const response: DeviceTokenExchangeResponse = {
            apiKey: rawToken,
            user: {
                email: workosUser.email,
                firstName: workosUser.firstName || null,
                displayName
            },
            organization: { id: membership.organizationId, name: membership.organizationName }
        }

        return res.status(201).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        }
        const handled = handleVerifyError(error, res, "device-token-exchange")
        if (handled) return handled
        return res.status(500).json({ error: "Failed to exchange token" })
    }
}

/**
 * GET /sdk/me/organizations
 *
 * Lists organizations the authenticated user belongs to, plus their current
 * active org (the one their API key is scoped to).
 */
export async function listMyOrganizations(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: user.workosId,
            statuses: ["active"]
        })
        const organizations = memberships.data.map(m => ({
            id: m.organizationId,
            name: m.organizationName
        }))
        const response: SdkOrganizationsListResponse = {
            organizations,
            activeOrganizationId: user.organizationId
        }
        return res.json(response)
    } catch (error: any) {
        logger.error("[me/organizations] Failed", { error, userId: user.id })
        return res.status(500).json({ error: "Failed to list organizations" })
    }
}

/**
 * POST /sdk/auth/switch-organization
 *
 * Mints a new API key scoped to a different org the user is a member of, so
 * the CLI can switch its active org without going through the full login
 * flow. The previous key is left intact.
 */
export async function switchOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const { organizationId } = switchOrganizationRequestSchema.parse(req.body)
        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: user.workosId,
            statuses: ["active"]
        })
        const membership = memberships.data.find(m => m.organizationId === organizationId)
        if (!membership) {
            return res.status(403).json({ error: "You are not a member of that organization" })
        }

        const { rawToken } = await createApiToken(user.id, organizationId, "CLI Login")

        const response: SwitchOrganizationResponse = {
            apiKey: rawToken,
            organization: { id: membership.organizationId, name: membership.organizationName }
        }
        return res.status(201).json(response)
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        }
        logger.error("[switch-organization] Failed", { error, userId: user.id })
        return res.status(500).json({ error: "Failed to switch organization" })
    }
}
