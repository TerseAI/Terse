import { User as WorkOSUser } from "@workos-inc/node"
import crypto from "crypto"
import { Response } from "express"
import { ApiRoutes, UserMetadata, userMetadataSchema } from "terse-types"
import { Role, User } from "terse-types/types"

import logger from "../../common/logger"
import { settings } from "../../settings"
import { AccessTokenClaims } from "../../domains/auth/helpers/accessTokenClaims"
import { extractErrorMessage } from "../../common/strings"
import { workos } from "../../integrations/workos/helpers"

import { createUserWithDefaultNotifications, findUserByWorkosId } from "./repository"

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
        metadata?: Record<string, string>
    }
    organizationId?: string | null
    roles?: string[]
}

export function buildWorkOSLoginUrl(res: Response): string {
    const state = crypto.randomBytes(32).toString("hex")
    res.cookie(WORKOS_OAUTH_STATE_COOKIE_NAME, state, WORKOS_OAUTH_STATE_COOKIE_OPTIONS)
    return workos.userManagement.getAuthorizationUrl({
        provider: "authkit",
        redirectUri: settings.workos.redirectUri,
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

export async function getWorkOSLogoutUrl(sealedSessionData: string | undefined, returnTo: string): Promise<string | null> {
    if (!sealedSessionData) return null
    const session = workos.userManagement.loadSealedSession({
        sessionData: sealedSessionData,
        cookiePassword: settings.workos.cookiePassword
    })
    return session.getLogoutUrl({ returnTo })
}

type UserWithMetadata = Omit<WorkOSUser, "metadata"> & { metadata: UserMetadata }

async function setDefaultUserMetadata(workosUserId: string, dbUserId: string): Promise<UserWithMetadata> {
    const metadata = userMetadataSchema.parse({ db_id: dbUserId })
    const user = await workos.userManagement.updateUser({ userId: workosUserId, metadata })
    return {
        ...user,
        metadata: userMetadataSchema.parse(user.metadata)
    }
}

export async function getOrCreateDbUserFromWorkOS(authContext: WorkOSAuthContext, claims?: AccessTokenClaims | null): Promise<{ user: User }> {
    const workosUser = authContext.user

    // Fast path: JWT Template claims have our DB ID and org name — skip DB/WorkOS API calls
    if (claims) {
        const user: User = {
            id: claims.dbId,
            workosId: workosUser.id,
            organizationId: authContext.organizationId ?? "",
            organizationName: claims.orgName,
            email: workosUser.email,
            displayName: [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || "",
            firstName: workosUser.firstName || null,
            lastName: workosUser.lastName || null,
            displayPhotoUrl: workosUser.profilePictureUrl || "",
            roles: (authContext.roles || []) as Role[]
        }
        return { user }
    }

    // Slow path: claims missing — look up DB user and org name
    let dbUser = await findUserByWorkosId(workosUser.id)
    let isNewUser = false
    if (!dbUser) {
        dbUser = await createUserWithDefaultNotifications(workosUser.id)
        isNewUser = true
    }

    if (isNewUser || !workosUser.metadata?.db_id) {
        try {
            await setDefaultUserMetadata(workosUser.id, dbUser.id)
        } catch (error) {
            logger.warn("Failed to backfill WorkOS user metadata with db_id", { error: extractErrorMessage(error) })
        }
    }

    let organizationName: string | undefined = undefined
    if (authContext.organizationId) {
        const organization = await workos.organizations.getOrganization(authContext.organizationId)
        organizationName = organization.name
    }

    const user: User = {
        id: dbUser.id,
        workosId: workosUser.id,
        organizationId: authContext.organizationId ?? "",
        organizationName: organizationName ?? "",
        email: workosUser.email,
        displayName: [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || "",
        firstName: workosUser.firstName || null,
        lastName: workosUser.lastName || null,
        displayPhotoUrl: workosUser.profilePictureUrl || "",
        roles: (authContext.roles || []) as Role[]
    }
    return { user }
}
