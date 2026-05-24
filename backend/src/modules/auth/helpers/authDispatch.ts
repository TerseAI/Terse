import { TokenKind } from "@prisma/client"
import { Request, Response } from "express"
import { User } from "terse-types/types"

import { secretsMatch } from "../../../common/crypto"
import logger from "../../../common/logger"
import { CronJobIntegrationManager } from "../../../integrations/cronJob/integration"
import { workos } from "../../../integrations/workos/helpers"
import { resolveUserInOrg } from "../../../integrations/workos/helpers"
import { db } from "../../../loaders/prisma"
import { WORKOS_SESSION_COOKIE_NAME, buildUserFromWorkOS, setSessionCookie } from "../../../modules/auth/service"
import { settings } from "../../../settings"

import { getClaimsFromAuthResult } from "./accessTokenClaims"
import { hashToken } from "./apiTokens"

export type CookieAuthOutcome = { ok: true; user: User } | { ok: false; reason: "no_cookie" | "auth_failed" }

export async function authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome> {
    if (!sealedSessionData) {
        return { ok: false, reason: "no_cookie" }
    }

    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData: sealedSessionData,
            cookiePassword: settings.workos.cookiePassword
        })
        const authResult = await session.authenticate()

        if (authResult.authenticated) {
            const claims = getClaimsFromAuthResult(authResult)
            const { user } = await buildUserFromWorkOS(authResult, claims)
            return { ok: true, user }
        }

        if (authResult.reason === "no_session_cookie_provided") {
            return { ok: false, reason: "no_cookie" }
        }

        logger.info("Session expired, attempting refresh", { reason: authResult.reason })
        const refreshed = await session.refresh({ cookiePassword: settings.workos.cookiePassword })
        if (!refreshed.authenticated) {
            logger.warn("Session refresh failed")
            return { ok: false, reason: "auth_failed" }
        }
        const { user } = await buildUserFromWorkOS(refreshed)
        if (refreshed.sealedSession) {
            setSessionCookie(res, refreshed.sealedSession)
            if (req.cookies) {
                req.cookies[WORKOS_SESSION_COOKIE_NAME] = refreshed.sealedSession
            }
        }
        return { ok: true, user }
    } catch (error) {
        logger.error("Cookie auth failed", { error })
        return { ok: false, reason: "auth_failed" }
    }
}

export type ApiTokenAuthOutcome = { ok: true; user: User; tokenKind: TokenKind } | { ok: false; reason: "not_found" | "expired" | "user_org_unresolved" }

export async function authenticateViaApiToken(rawToken: string): Promise<ApiTokenAuthOutcome> {
    const tokenHash = hashToken(rawToken)
    const apiToken = await db().api_tokens.findUnique({ where: { token_hash: tokenHash } })

    if (!apiToken) {
        return { ok: false, reason: "not_found" }
    }

    if (apiToken.expires_at && apiToken.expires_at.getTime() < Date.now()) {
        logger.warn("API token has expired; rejecting", { tokenId: apiToken.id, kind: apiToken.kind })
        return { ok: false, reason: "expired" }
    }

    const user = await resolveUserInOrg(apiToken.user_id, apiToken.organization_id)
    if (!user) {
        logger.warn("API token references a user/org that no longer resolves; rejecting", {
            tokenId: apiToken.id,
            userId: apiToken.user_id,
            organizationId: apiToken.organization_id
        })
        return { ok: false, reason: "user_org_unresolved" }
    }

    db()
        .api_tokens.update({
            where: { id: apiToken.id },
            data: { last_used_at: new Date() }
        })
        .catch(err => logger.warn("Failed to update api_token last_used_at", { error: err, tokenId: apiToken.id }))

    return { ok: true, user, tokenKind: apiToken.kind }
}

export function validateCloudSchedulerHeader(authHeaderValue: string | undefined): boolean {
    if (!authHeaderValue) return false
    const cron = new CronJobIntegrationManager()
    if (!cron.isAvailable) return false
    const token = authHeaderValue.startsWith("Bearer ") ? authHeaderValue.substring(7) : authHeaderValue
    return secretsMatch(token, cron.config.secret)
}

export function readBearerToken(authHeaderValue: string | undefined): string | null {
    if (!authHeaderValue || !authHeaderValue.startsWith("Bearer ")) return null
    const value = authHeaderValue.slice(7)
    return value.length > 0 ? value : null
}

export function readSealedSessionCookie(cookies: Record<string, string> | undefined): string | undefined {
    return cookies?.[WORKOS_SESSION_COOKIE_NAME]
}
