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
import { workos } from "../../../integrations/workos/helpers"
import { WorkosTokenError, verifyWorkosJwt } from "../../../integrations/workos/jwt"
import { createApiToken } from "../../../modules/auth/helpers/apiTokens"

const featureFlagService = FeatureFlagService.getInstance()

const CLI_LOGIN_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
function cliLoginExpiry(): Date {
    return new Date(Date.now() + CLI_LOGIN_TOKEN_TTL_MS)
}

async function verifyWorkosAccessToken(accessToken: string): Promise<{ workosUserId: string }> {
    const payload = await verifyWorkosJwt(accessToken)
    const workosUserId = payload.sub as string | undefined
    if (!workosUserId) throw new WorkosTokenError(401, "Invalid access token: missing subject")
    return { workosUserId }
}

function handleVerifyError(error: any, res: Response, route: string): Response | null {
    if (error instanceof WorkosTokenError) return res.status(error.status).json({ error: error.message })
    if (error?.code === "ERR_JWT_EXPIRED" || error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWKS_NO_MATCHING_KEY") {
        return res.status(401).json({ error: "Invalid or expired access token" })
    }
    logger.error(`[${route}] Unexpected error`, { error })
    return null
}

export async function identify(req: Request, res: Response) {
    try {
        const { accessToken } = identifyRequestSchema.parse(req.body)
        const { workosUserId } = await verifyWorkosAccessToken(accessToken)
        const workosUser = await workos.userManagement.getUser(workosUserId)

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) return res.status(403).json({ error: "SDK interface is not enabled for your account" })

        const memberships = await workos.userManagement.listOrganizationMemberships({ userId: workosUserId, statuses: ["active"] })

        const orgs = memberships.data.map(m => ({ id: m.organizationId, name: m.organizationName, roles: m.roles?.map(r => r.slug) ?? [] }))
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
        if (error instanceof ZodError) return res.status(400).json({ error: "Invalid request body", issues: error.issues })
        const handled = handleVerifyError(error, res, "identify")
        if (handled) return handled
        return res.status(500).json({ error: "Failed to identify user" })
    }
}

export async function deviceTokenExchange(req: Request, res: Response) {
    try {
        const { accessToken, organizationId } = deviceTokenExchangeRequestSchema.parse(req.body)
        const { workosUserId } = await verifyWorkosAccessToken(accessToken)
        const workosUser = await workos.userManagement.getUser(workosUserId)

        const isSdkEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, workosUser.email, { email: workosUser.email })
        if (!isSdkEnabled) return res.status(403).json({ error: "SDK interface is not enabled for your account" })

        const memberships = await workos.userManagement.listOrganizationMemberships({ userId: workosUserId, statuses: ["active"] })
        const membership = memberships.data.find(m => m.organizationId === organizationId)
        if (!membership) return res.status(403).json({ error: "You are not a member of that organization" })

        const { rawToken } = await createApiToken(workosUserId, organizationId, "CLI Login", { expiresAt: cliLoginExpiry() })

        const displayName = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || null

        const response: DeviceTokenExchangeResponse = {
            apiKey: rawToken,
            user: { email: workosUser.email, firstName: workosUser.firstName || null, displayName },
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
        const memberships = await workos.userManagement.listOrganizationMemberships({ userId: user.id, statuses: ["active"] })
        const organizations = memberships.data.map(m => ({ id: m.organizationId, name: m.organizationName }))
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
        const memberships = await workos.userManagement.listOrganizationMemberships({ userId: user.id, statuses: ["active"] })
        const membership = memberships.data.find(m => m.organizationId === organizationId)
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
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    try {
        const workOSUser = await workos.userManagement.getUser(user.id)
        return res.json({
            id: user.id,
            email: workOSUser.email,
            firstName: workOSUser.firstName || null,
            lastName: workOSUser.lastName || null,
            displayName: [workOSUser.firstName, workOSUser.lastName].filter(Boolean).join(" ") || null,
            organizationId: user.organizationId,
            organization: user.organizationId ? { id: user.organizationId, name: user.organizationName } : null
        })
    } catch (error) {
        logger.error("[/sdk/me] Failed to fetch user from WorkOS", { error })
        return res.status(500).json({ error: "Failed to fetch user" })
    }
}
