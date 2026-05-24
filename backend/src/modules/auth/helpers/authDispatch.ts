import { TokenKind } from "@prisma/client"
import { Request, Response } from "express"
import { UserSession } from "terse-types/types"

import { secretsMatch } from "../../../common/crypto"
import logger from "../../../common/logger"
import { WORKOS_SESSION_COOKIE_NAME } from "../../../ee/services/authProvider/service"
import { CronJobIntegrationManager } from "../../../integrations/cronJob/integration"
import { db } from "../../../loaders/prisma"
import { getAuthProvider } from "../../../services/authProvider"
import { CookieAuthOutcome } from "../../../services/authProvider/AuthProvider"
import { resolveUserInOrg } from "../../../utility/identity"

import { hashToken } from "./apiTokens"

export async function authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome> {
    return await getAuthProvider().authenticateViaCookie(sealedSessionData, req, res)
}

export type ApiTokenAuthOutcome = { ok: true; user: UserSession; tokenKind: TokenKind } | { ok: false; reason: "not_found" | "expired" | "user_org_unresolved" }

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
