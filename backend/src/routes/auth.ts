import { users as PrismaUser } from "@prisma/client"
import { AuthenticateWithSessionCookieSuccessResponse, AuthenticationResponse } from "@workos-inc/node"
import { NextFunction, Request, Response } from "express"
import { ApiRoutes } from "terse-types"
import { Role, User } from "terse-types/types"

import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { Session } from "../types/session"
import { AccessTokenClaims, getClaimsFromAuthResult } from "../utility/accessTokenClaims"
import { extractErrorMessage } from "../utility/strings"
import { workos } from "../utility/workos"

export const WORKOS_SESSION_COOKIE_NAME = "TERSE_WORKOS_SESSION"

export function setSessionCookie(res: Response, sealedSession: string) {
    res.cookie(WORKOS_SESSION_COOKIE_NAME, sealedSession, WORKOS_SESSION_COOKIE_OPTIONS)
}

export function clearSessionCookies(res: Response) {
    res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const workosSessionCookieBaseOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax" as const,
    maxAge: SEVEN_DAYS_MS
}

export const WORKOS_SESSION_COOKIE_OPTIONS = settings.optional.cookieDomain ? { ...workosSessionCookieBaseOptions, domain: settings.optional.cookieDomain } : workosSessionCookieBaseOptions

function getDirectWorkOSLoginUrl(): string {
    return workos.userManagement.getAuthorizationUrl({
        provider: "authkit",
        redirectUri: settings.workos.redirectUri
    })
}

export async function login(req: Request, res: Response) {
    const authorizationUrl = getDirectWorkOSLoginUrl()
    res.redirect(authorizationUrl)
}

export async function loginUrl(req: Request, res: Response) {
    const authorizationUrl = getDirectWorkOSLoginUrl()
    return res.json({ loginUrl: authorizationUrl })
}

function shouldRedirectToLogin(value: unknown): boolean {
    const queryValue = Array.isArray(value) ? value[0] : value
    if (typeof queryValue !== "string") {
        return false
    }
    const normalizedValue = queryValue.trim().toLowerCase()
    return normalizedValue === "true" || normalizedValue === "1"
}

function getBackendLoginUrl(): string {
    if (!settings.urls.backend) {
        return getDirectWorkOSLoginUrl()
    }
    const normalizedBackendUrl = settings.urls.backend.endsWith("/") ? settings.urls.backend : `${settings.urls.backend}/`
    const loginPath = ApiRoutes.AUTH.LOGIN.replace(/^\//, "")
    return new URL(loginPath, normalizedBackendUrl).toString()
}

function getPostLogoutRedirectUrl(redirectToLogin: boolean): string {
    return redirectToLogin ? getBackendLoginUrl() : settings.urls.frontend
}

async function getDirectWorkOSLogoutUrl(sealedSessionData: string | undefined, returnTo: string): Promise<string | null> {
    if (!sealedSessionData) {
        return null
    }

    const session = workos.userManagement.loadSealedSession({
        sessionData: sealedSessionData,
        cookiePassword: settings.workos.cookiePassword
    })
    return session.getLogoutUrl({ returnTo })
}

export async function logoutUrl(req: Request, res: Response) {
    const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
    const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
    clearSessionCookies(res)

    try {
        const workosLogoutUrl = await getDirectWorkOSLogoutUrl(sealedSessionData, postLogoutRedirectUrl)
        return res.json({ logoutUrl: workosLogoutUrl ?? postLogoutRedirectUrl })
    } catch (error) {
        logger.warn("[/logout/url] Failed to build WorkOS logout URL, falling back to post-logout redirect", {
            error,
            postLogoutRedirectUrl
        })
        return res.json({ logoutUrl: postLogoutRedirectUrl })
    }
}

export async function logout(req: Request, res: Response) {
    const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
    const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
    clearSessionCookies(res)

    try {
        const workosLogoutUrl = await getDirectWorkOSLogoutUrl(sealedSessionData, postLogoutRedirectUrl)
        if (!workosLogoutUrl) {
            logger.info("[/logout] No session cookie found, redirecting to post-logout URL", {
                postLogoutRedirectUrl
            })
            return res.redirect(postLogoutRedirectUrl)
        }
        return res.redirect(workosLogoutUrl)
    } catch (error) {
        logger.warn("[/logout] Failed to build WorkOS logout URL, falling back to post-logout redirect", {
            error,
            postLogoutRedirectUrl
        })
        return res.redirect(postLogoutRedirectUrl)
    }
}

export async function me(req: Request, res: Response) {
    const user = req.session?.user || null
    if (!user) {
        return res.status(401).send("Unauthorized")
    }

    // Always fetch fresh profile data from WorkOS so profile updates (e.g., from User Profile widget)
    // are reflected immediately when the frontend calls refreshUser()
    try {
        const workOSUser = await workos.userManagement.getUser(user.workosId)

        const refreshedUser: User = {
            ...user,
            email: workOSUser.email,
            displayName: [workOSUser.firstName, workOSUser.lastName].filter(Boolean).join(" ") || "",
            firstName: workOSUser.firstName || null,
            lastName: workOSUser.lastName || null,
            displayPhotoUrl: workOSUser.profilePictureUrl || ""
        }

        return res.send(refreshedUser)
    } catch (error) {
        logger.warn("[/me] Failed to fetch fresh user from WorkOS, returning session user", {
            error: extractErrorMessage(error)
        })
        return res.send(user)
    }
}

function createAuthMiddleware(requireOrganization: boolean) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // If apiTokenAuthMiddleware already populated the session, skip cookie auth
        if (req.session?.user) {
            if (requireOrganization && !req.session.user.organizationId) {
                return sendOrganizationRequired(req, res)
            }
            return next()
        }

        try {
            const session = workos.userManagement.loadSealedSession({
                sessionData: req.cookies[WORKOS_SESSION_COOKIE_NAME],
                cookiePassword: settings.workos.cookiePassword
            })
            const authResult = await session.authenticate()

            if (authResult.authenticated) {
                const claims = getClaimsFromAuthResult(authResult)
                const { user } = await getOrCreateDbUserFromWorkOS(authResult, claims)
                if (!req.session) {
                    req.session = {
                        user,
                        isUserInitiated: true
                    }
                } else {
                    req.session.user = user
                    req.session.isUserInitiated = true
                }
                if (requireOrganization && !user.organizationId) {
                    return sendOrganizationRequired(req, res)
                }
                return next()
            }

            // Give up if no cookie is provided
            const authenticated = authResult.authenticated
            const authFailedReason = authResult.reason
            if (!authenticated && authFailedReason === "no_session_cookie_provided") {
                return sendUnauthorized(req, res)
            }

            // try refreshing the session, it may have gone stale
            logger.info("Session expired, attempting refresh", {
                reason: authFailedReason
            })
            const refreshedSessionResult = await session.refresh({
                cookiePassword: settings.workos.cookiePassword
            })
            if (!refreshedSessionResult.authenticated) {
                logger.warn("Session refresh failed")
                return sendUnauthorized(req, res)
            }
            logger.info("Session refreshed successfully")
            // After a session refresh, no access token is available — always do full DB lookup
            const { user } = await getOrCreateDbUserFromWorkOS(refreshedSessionResult)
            if (!req.session) {
                req.session = {
                    user,
                    isUserInitiated: true
                } as Session
            } else {
                req.session.user = user
                req.session.isUserInitiated = true
            }

            if (requireOrganization && !user.organizationId) {
                return sendOrganizationRequired(req, res)
            }

            // update the cookie if we have a sealed session
            if (refreshedSessionResult.sealedSession) {
                setSessionCookie(res, refreshedSessionResult.sealedSession)
                // Keep request-scoped cookie data in sync so downstream handlers in the
                // same request (e.g. /session/token) read the refreshed sealed session.
                if (req.cookies) {
                    req.cookies[WORKOS_SESSION_COOKIE_NAME] = refreshedSessionResult.sealedSession
                }
            }
            return next()
        } catch (error) {
            logger.error("Failed to authorize user", {
                error
            })
            clearSessionCookies(res)
            return sendUnauthorized(req, res)
        }
    }
}

function isApiRequest(req: Request): boolean {
    const acceptHeader = req.get("accept") || ""
    return acceptHeader.includes("application/json")
}

function sendUnauthorized(req: Request, res: Response) {
    if (isApiRequest(req)) {
        return res.status(401).json({ error: "Unauthorized" })
    }
    return res.redirect("/login")
}

function sendOrganizationRequired(req: Request, res: Response) {
    return res.status(403).json({
        code: "ORGANIZATION_REQUIRED",
        message: "User must create or join an organization",
        redirectTo: "/organization/create"
    })
}

export async function callback(req: Request, res: Response) {
    const code = req.query.code as string

    if (!code) {
        if (req.query.error) {
            logger.warn("[/callback] WorkOS returned an error to the callback", {
                error: req.query.error
            })
        }
        return res.status(400).send("No code provided")
    }

    try {
        const authenticateResponse = await workos.userManagement.authenticateWithCode({
            clientId: settings.workos.clientId,
            code,
            session: {
                sealSession: true,
                cookiePassword: settings.workos.cookiePassword
            }
        })

        if (!authenticateResponse.sealedSession) {
            logger.error("[/callback] No sealed session in authenticate response")
            return res.status(401).send("No sealed session provided")
        }

        const workosSession = workos.userManagement.loadSealedSession({
            sessionData: authenticateResponse.sealedSession,
            cookiePassword: settings.workos.cookiePassword
        })

        const authResult = await workosSession.authenticate()

        if (!authResult.authenticated) {
            logger.warn("[/callback] Session authentication failed", {
                reason: (authResult as { reason?: string }).reason
            })
            return res.status(401).send("Failed to authenticate")
        }

        const claims = getClaimsFromAuthResult(authResult)
        await getOrCreateDbUserFromWorkOS(authResult, claims)

        setSessionCookie(res, authenticateResponse.sealedSession)

        return res.redirect(settings.urls.frontend)
    } catch (error) {
        logger.error("[/callback] WorkOS callback error", {
            errorName: error instanceof Error ? error.name : "Unknown",
            errorMessage: extractErrorMessage(error),
            stack: error instanceof Error ? error.stack : undefined
        })

        // Don't redirect to /login here as it causes an infinite redirect loop
        // Clear any stale session cookie and show an error
        clearSessionCookies(res)
        return res
            .status(500)
            .send(`Authentication failed. ` + `Please <a href="${settings.urls.frontend}">return to the app</a> and try again. ` + `If the problem persists, clear your cookies for this site.`)
    }
}

export async function getWorkOSWidgetToken(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }
    if (!user.organizationId) {
        return res.status(400).json({
            error: "User has no organization. Create an organization first."
        })
    }
    const workosUserId = user?.workosId
    if (!workosUserId) {
        return res.status(400).json({
            error: "User has no WorkOS ID. Re-authenticate to link account."
        })
    }

    const widgetToken = await workos.widgets.getToken({
        organizationId: user.organizationId,
        userId: workosUserId
    })

    return res.json({ token: widgetToken })
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

    // Slow path: claims missing (JWT Template not configured, or user metadata not yet backfilled)
    // Look up the DB user and org name via DB + WorkOS API
    const prisma = db()
    let dbUser: PrismaUser | null = await prisma.users.findUnique({
        where: {
            workos_id: workosUser.id
        }
    })
    let isNewUser = false
    if (!dbUser) {
        dbUser = await prisma.users.create({
            data: {
                workos_id: workosUser.id,
                notification_settings: {
                    create: {
                        agent_default_notifications: ["error"],
                        weekly_agent_improvements: true
                    }
                }
            }
        })
        isNewUser = true
    }

    // Backfill WorkOS user metadata with our DB ID so future requests get it via JWT Template claims
    if (isNewUser || !workosUser.metadata?.db_id) {
        try {
            await workos.userManagement.updateUser({
                userId: workosUser.id,
                metadata: { db_id: dbUser.id }
            })
        } catch (error) {
            logger.warn("Failed to backfill WorkOS user metadata with db_id", { error: extractErrorMessage(error) })
        }
    }

    let organizationName = undefined
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

// Library doesn't export this type properly, so we need to define it ourselves
type RefreshSessionSuccessResponse = Omit<AuthenticateWithSessionCookieSuccessResponse, "accessToken"> & {
    authenticated: true
    session?: AuthenticationResponse
    sealedSession?: string
}

// By default, every user must be in an organization for most routes
export const authMiddleware = createAuthMiddleware(true)

// Some routes have an exception to this rule
export const authMiddlewareAllowNoOrg = createAuthMiddleware(false)

export default { me, login, loginUrl, logout, logoutUrl, getWorkOSWidgetToken, callback }
