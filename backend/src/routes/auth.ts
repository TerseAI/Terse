import { users as PrismaUser } from "@prisma/client"
import { AuthenticateWithSessionCookieSuccessResponse, AuthenticationResponse } from "@workos-inc/node"
import { NextFunction, Request, Response } from "express"

import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { ApiRoutes } from "../shared/ApiRoutes"
import { Role, User } from "../shared/types"
import { Session } from "../types/session"
import { workos } from "../utility/workos"

export const WORKOS_SESSION_COOKIE_NAME = "TERSE_WORKOS_SESSION"

const workosSessionCookieBaseOptions = {
    path: "/",
    httpOnly: true,
    secure: settings.nodeEnv === "production",
    sameSite: "lax" as const
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
    res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)

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
    res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)

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
    logger.info("[/me] Endpoint called", {
        hasSessionCookie: !!req.cookies[WORKOS_SESSION_COOKIE_NAME],
        hasSession: !!req.session,
        hasSessionUser: !!req.session?.user,
        cookies: Object.keys(req.cookies || {})
    })

    const user = req.session?.user || null
    if (!user) {
        logger.warn("[/me] No user in session, returning 401", {
            sessionKeys: req.session ? Object.keys(req.session) : []
        })
        return res.status(401).send("Unauthorized")
    }

    logger.info("[/me] User found in session", {
        userId: user.id,
        workosId: user.workosId,
        email: user.email,
        organizationId: user.organizationId
    })

    // Always fetch fresh profile data from WorkOS so profile updates (e.g., from User Profile widget)
    // are reflected immediately when the frontend calls refreshUser()
    try {
        logger.info("[/me] Fetching fresh user from WorkOS", {
            workosId: user.workosId
        })
        const workOSUser = await workos.userManagement.getUser(user.workosId)
        logger.info("[/me] Successfully fetched WorkOS user", {
            workosUserId: workOSUser.id,
            email: workOSUser.email,
            hasFirstName: !!workOSUser.firstName,
            hasLastName: !!workOSUser.lastName,
            hasProfilePicture: !!workOSUser.profilePictureUrl
        })

        const refreshedUser: User = {
            ...user,
            email: workOSUser.email,
            displayName: workOSUser.firstName + " " + workOSUser.lastName,
            firstName: workOSUser.firstName || null,
            lastName: workOSUser.lastName || null,
            displayPhotoUrl: workOSUser.profilePictureUrl || ""
        }

        logger.info("[/me] Returning refreshed user", {
            userId: refreshedUser.id,
            email: refreshedUser.email
        })
        return res.send(refreshedUser)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.warn("[/me] Failed to fetch fresh user from WorkOS, returning session user", {
            error: errorMessage,
            stack: errorStack,
            userId: user.id,
            workosId: user.workosId
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
                const user = await getOrCreateDbUserFromWorkOS(authResult)
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
            const user = await getOrCreateDbUserFromWorkOS(refreshedSessionResult)
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
                res.cookie(WORKOS_SESSION_COOKIE_NAME, refreshedSessionResult.sealedSession, WORKOS_SESSION_COOKIE_OPTIONS)
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
            res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)
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
    logger.info("[/callback] Endpoint called", {
        hasCode: !!req.query.code,
        queryParams: Object.keys(req.query || {}),
        hasError: !!req.query.error,
        error: req.query.error,
        errorDescription: req.query.error_description
    })

    const code = req.query.code as string

    if (!code) {
        logger.warn("[/callback] No code provided in query params", {
            query: req.query
        })
        return res.status(400).send("No code provided")
    }

    logger.info("[/callback] Code received, authenticating with WorkOS", {
        codeLength: code.length,
        codePrefix: code.substring(0, 10) + "...",
        clientId: settings.workos.clientId,
        redirectUri: settings.workos.redirectUri
    })

    try {
        logger.info("[/callback] Calling workos.userManagement.authenticateWithCode")
        const authenticateResponse = await workos.userManagement.authenticateWithCode({
            clientId: settings.workos.clientId,
            code,
            session: {
                sealSession: true,
                cookiePassword: settings.workos.cookiePassword
            }
        })

        logger.info("[/callback] authenticateWithCode response received", {
            hasSealedSession: !!authenticateResponse.sealedSession,
            hasUser: !!authenticateResponse.user,
            userId: authenticateResponse.user?.id,
            userEmail: authenticateResponse.user?.email,
            hasOrganizationId: !!authenticateResponse.organizationId,
            organizationId: authenticateResponse.organizationId
        })

        if (!authenticateResponse.sealedSession) {
            logger.error("[/callback] No sealed session in authenticate response", {
                responseKeys: Object.keys(authenticateResponse)
            })
            return res.status(401).send("No sealed session provided")
        }

        logger.info("[/callback] Loading sealed session")
        const workosSession = workos.userManagement.loadSealedSession({
            sessionData: authenticateResponse.sealedSession,
            cookiePassword: settings.workos.cookiePassword
        })

        logger.info("[/callback] Authenticating loaded session")
        const authResult = await workosSession.authenticate()

        logger.info("[/callback] Session authentication result", {
            authenticated: authResult.authenticated,
            reason: !authResult.authenticated ? (authResult as any).reason : undefined,
            userId: authResult.authenticated ? authResult.user?.id : undefined,
            organizationId: authResult.authenticated ? authResult.organizationId : undefined,
            roles: authResult.authenticated ? authResult.roles : undefined
        })

        if (!authResult.authenticated) {
            logger.error("[/callback] Session authentication failed", {
                reason: (authResult as any).reason
            })
            return res.status(401).send("Failed to authenticate")
        }

        // Create user record in database if it doesn't already
        // exist
        logger.info("[/callback] Creating/fetching user from database", {
            workosUserId: authResult.user.id,
            email: authResult.user.email
        })
        const dbUser = await getOrCreateDbUserFromWorkOS(authResult)
        logger.info("[/callback] Database user ready", {
            dbUserId: dbUser.id,
            workosId: dbUser.workosId,
            organizationId: dbUser.organizationId
        })

        // Store the session in a cookie
        logger.info("[/callback] Setting session cookie", {
            cookieName: WORKOS_SESSION_COOKIE_NAME,
            secure: settings.nodeEnv === "production",
            sealedSessionLength: authenticateResponse.sealedSession.length
        })
        res.cookie(WORKOS_SESSION_COOKIE_NAME, authenticateResponse.sealedSession, WORKOS_SESSION_COOKIE_OPTIONS)

        // Redirect the user to the homepage
        logger.info("[/callback] Authentication successful, redirecting to frontend", {
            redirectUrl: settings.urls.frontend
        })
        return res.redirect(settings.urls.frontend)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        const errorName = error instanceof Error ? error.name : "Unknown"

        logger.error("[/callback] WorkOS callback error", {
            errorName,
            errorMessage,
            errorStack,
            code: code ? `${code.substring(0, 10)}...` : undefined,
            clientId: settings.workos.clientId,
            redirectUri: settings.workos.redirectUri
        })

        // Don't redirect to /login here as it causes an infinite redirect loop
        // Clear any stale session cookie and show an error
        res.clearCookie(WORKOS_SESSION_COOKIE_NAME, WORKOS_SESSION_COOKIE_OPTIONS)
        return res
            .status(500)
            .send(
                `Authentication failed: ${errorMessage}. ` +
                    `Please <a href="${settings.urls.frontend}">return to the app</a> and try again. ` +
                    `If the problem persists, clear your cookies for this site.`
            )
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

export async function getOrCreateDbUserFromWorkOS(authResult: AuthenticateWithSessionCookieSuccessResponse | RefreshSessionSuccessResponse): Promise<User> {
    const prisma = db()
    const workosUser = authResult.user
    let dbUser: PrismaUser | null = await prisma.users.findUnique({
        where: {
            workos_id: workosUser.id
        }
    })
    if (!dbUser) {
        dbUser = await prisma.users.create({
            data: {
                workos_id: workosUser.id
            }
        })
    }

    const roles = authResult.roles || []

    let organizationName = undefined
    if (authResult.organizationId) {
        const organization = await workos.organizations.getOrganization(authResult.organizationId)
        organizationName = organization.name
    }

    return {
        id: dbUser.id,
        workosId: workosUser.id,
        organizationId: authResult.organizationId ?? "",
        organizationName: organizationName ?? "",
        email: workosUser.email,
        displayName: workosUser.firstName + " " + workosUser.lastName,
        firstName: workosUser.firstName || null,
        lastName: workosUser.lastName || null,
        displayPhotoUrl: workosUser.profilePictureUrl || "",
        roles: roles as Role[]
    }
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
