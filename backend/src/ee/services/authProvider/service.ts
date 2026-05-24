import { WorkOS } from "@workos-inc/node"
import crypto from "crypto"
import { Response } from "express"
import { ApiRoutes } from "terse-types"
import { Role, User } from "terse-types/types"

import { AccessTokenClaims } from "../../../modules/auth/helpers/accessTokenClaims"
import { settings } from "../../../settings"

export const WORKOS_SESSION_COOKIE_NAME = "TERSE_WORKOS_SESSION"
export const WORKOS_OAUTH_STATE_COOKIE_NAME = "TERSE_WORKOS_OAUTH_STATE"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const TEN_MINUTES_MS = 10 * 60 * 1000

const workosSessionCookieBaseOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax" as const,
    maxAge: ONE_DAY_MS
}

export const WORKOS_SESSION_COOKIE_OPTIONS = settings.optional.cookieDomain ? { ...workosSessionCookieBaseOptions, domain: settings.optional.cookieDomain } : workosSessionCookieBaseOptions

export const WORKOS_OAUTH_STATE_COOKIE_OPTIONS = {
    ...WORKOS_SESSION_COOKIE_OPTIONS,
    maxAge: TEN_MINUTES_MS
}

export function setSessionCookie(res: Response, sealedSession: string): void {
    res.cookie(WORKOS_SESSION_COOKIE_NAME, sealedSession, WORKOS_SESSION_COOKIE_OPTIONS)
}

export function clearSessionCookies(res: Response): void {
    res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)
}

export interface WorkOSAuthContext {
    user: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
        profilePictureUrl: string | null
    }
    organizationId?: string | null
    roles?: string[]
}

export function buildWorkOSLoginUrl(workos: WorkOS, res: Response, redirectUri: string): string {
    const state = crypto.randomBytes(32).toString("hex")
    res.cookie(WORKOS_OAUTH_STATE_COOKIE_NAME, state, WORKOS_OAUTH_STATE_COOKIE_OPTIONS)
    return workos.userManagement.getAuthorizationUrl({
        provider: "authkit",
        redirectUri,
        state
    })
}

function getBackendLoginUrl(): string {
    const normalizedBackendUrl = settings.urls.backend.endsWith("/") ? settings.urls.backend : `${settings.urls.backend}/`
    const loginPath = ApiRoutes.AUTH.LOGIN.replace(/^\//, "")
    return new URL(loginPath, normalizedBackendUrl).toString()
}

export function getPostLogoutRedirectUrl(redirectToLogin: boolean): string {
    return redirectToLogin ? getBackendLoginUrl() : settings.urls.frontend
}

export function shouldRedirectToLogin(value: unknown): boolean {
    const queryValue = Array.isArray(value) ? value[0] : value
    if (typeof queryValue !== "string") return false
    const normalizedValue = queryValue.trim().toLowerCase()
    return normalizedValue === "true" || normalizedValue === "1"
}

export async function getWorkOSLogoutUrl(workos: WorkOS, sealedSessionData: string | undefined, returnTo: string, cookiePassword: string): Promise<string | null> {
    if (!sealedSessionData) return null
    const session = workos.userManagement.loadSealedSession({
        sessionData: sealedSessionData,
        cookiePassword
    })
    return session.getLogoutUrl({ returnTo })
}

export async function buildUserFromWorkOS(workos: WorkOS, authContext: WorkOSAuthContext, claims?: AccessTokenClaims | null): Promise<{ user: User }> {
    const workosUser = authContext.user
    const organizationId = authContext.organizationId ?? ""

    // Fast path: org_name lifted from JWT custom claim (no extra WorkOS call).
    if (claims) {
        return {
            user: {
                id: workosUser.id,
                organizationId,
                organizationName: claims.orgName,
                email: workosUser.email,
                displayName: [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || "",
                firstName: workosUser.firstName || null,
                lastName: workosUser.lastName || null,
                displayPhotoUrl: workosUser.profilePictureUrl || "",
                roles: (authContext.roles || []) as Role[]
            }
        }
    }

    let organizationName = ""
    if (organizationId) {
        const organization = await workos.organizations.getOrganization(organizationId)
        organizationName = organization.name
    }

    return {
        user: {
            id: workosUser.id,
            organizationId,
            organizationName,
            email: workosUser.email,
            displayName: [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || "",
            firstName: workosUser.firstName || null,
            lastName: workosUser.lastName || null,
            displayPhotoUrl: workosUser.profilePictureUrl || "",
            roles: (authContext.roles || []) as Role[]
        }
    }
}
