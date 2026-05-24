import { WorkOS } from "@workos-inc/node"
import crypto from "crypto"
import express, { Express, Request, Response } from "express"
import { JWTPayload, jwtVerify } from "jose"
import { ApiRoutes, UserProfile, UserSession } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getClaimsFromAuthResult } from "../../../modules/auth/helpers/accessTokenClaims"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import AuthProvider, { AuthTokenError, CookieAuthOutcome } from "../../../services/authProvider/AuthProvider"
import { SettingsDependant, settings } from "../../../settings"

import {
    WORKOS_OAUTH_STATE_COOKIE_NAME,
    WORKOS_OAUTH_STATE_COOKIE_OPTIONS,
    WORKOS_SESSION_COOKIE_NAME,
    buildUserFromWorkOS,
    buildWorkOSLoginUrl,
    clearSessionCookies,
    getPostLogoutRedirectUrl,
    getWorkOSLogoutUrl,
    setSessionCookie,
    shouldRedirectToLogin
} from "./service"
import { handleWorkOSWebhook } from "./workosWebhook"

export class WorkOSAuthProvider extends SettingsDependant implements AuthProvider {
    readonly settingsKey = "workos"

    readonly workos = new WorkOS({
        apiKey: this.config.apiKey,
        clientId: this.config.clientId
    })

    // Auth webhook from Terse's own WorkOS account (user/session lifecycle). Always on while WorkOS is the auth provider.
    registerRoutes(app: Express): void {
        app.use(ApiRoutes.WEBHOOKS.WORKOS, express.raw({ type: "application/json" }))
        app.post(ApiRoutes.WEBHOOKS.WORKOS, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            handleWorkOSWebhook(this.workos, this.config.webhookSecret, req, res)
        })
    }

    async getUser(userId: string): Promise<UserProfile | null> {
        const workosUser = await this.workos.userManagement.getUser(userId)
        if (!workosUser) return null
        return {
            id: workosUser.id,
            email: workosUser.email,
            displayName: [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") || "",
            firstName: workosUser.firstName || null,
            lastName: workosUser.lastName || null,
            displayPhotoUrl: workosUser.profilePictureUrl || ""
        }
    }

    async verifyJWT(token: string): Promise<JWTPayload> {
        const jwks = await this.workos.userManagement.getJWKS()
        if (!jwks) {
            throw new AuthTokenError(500, "WorkOS JWKS unavailable")
        }
        const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"] })
        return payload
    }

    async login(_req: Request, res: Response): Promise<void> {
        const authorizationUrl = buildWorkOSLoginUrl(this.workos, res, this.config.redirectUri)
        res.redirect(authorizationUrl)
    }

    async loginUrl(_req: Request, res: Response): Promise<void> {
        const authorizationUrl = buildWorkOSLoginUrl(this.workos, res, this.config.redirectUri)
        res.json({ loginUrl: authorizationUrl })
    }

    async logoutUrl(req: Request, res: Response): Promise<void> {
        const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
        const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
        const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
        clearSessionCookies(res)

        try {
            const workosLogoutUrl = await getWorkOSLogoutUrl(this.workos, sealedSessionData, postLogoutRedirectUrl, this.config.cookiePassword)
            res.json({ logoutUrl: workosLogoutUrl ?? postLogoutRedirectUrl })
        } catch (error) {
            logger.warn("[/logout/url] Failed to build WorkOS logout URL, falling back to post-logout redirect", { error, postLogoutRedirectUrl })
            res.json({ logoutUrl: postLogoutRedirectUrl })
        }
    }

    async logout(req: Request, res: Response): Promise<void> {
        const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
        const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
        const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
        clearSessionCookies(res)

        try {
            const workosLogoutUrl = await getWorkOSLogoutUrl(this.workos, sealedSessionData, postLogoutRedirectUrl, this.config.cookiePassword)
            if (!workosLogoutUrl) {
                logger.info("[/logout] No session cookie found, redirecting to post-logout URL", { postLogoutRedirectUrl })
                return res.redirect(postLogoutRedirectUrl)
            }
            return res.redirect(workosLogoutUrl)
        } catch (error) {
            logger.warn("[/logout] Failed to build WorkOS logout URL, falling back to post-logout redirect", { error, postLogoutRedirectUrl })
            return res.redirect(postLogoutRedirectUrl)
        }
    }

    async me(req: Request, res: Response): Promise<void> {
        const user = req.session?.user || null
        if (!user) {
            res.status(401).send("Unauthorized")
            return
        }

        try {
            const workOSUser = await this.workos.userManagement.getUser(user.id)
            const refreshedUser: UserSession = {
                id: workOSUser.id,
                email: workOSUser.email,
                displayName: [workOSUser.firstName, workOSUser.lastName].filter(Boolean).join(" ") || "",
                firstName: workOSUser.firstName || null,
                lastName: workOSUser.lastName || null,
                displayPhotoUrl: workOSUser.profilePictureUrl || "",
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                roles: user.roles
            }
            res.send(refreshedUser)
        } catch (error) {
            logger.warn("[/me] Failed to fetch fresh user from WorkOS, returning session user", { error: extractErrorMessage(error) })
            res.send(user)
        }
    }

    async callback(req: Request, res: Response): Promise<void> {
        const code = req.query.code as string
        const state = typeof req.query.state === "string" ? req.query.state : undefined
        const expectedState = req.cookies?.[WORKOS_OAUTH_STATE_COOKIE_NAME] as string | undefined

        res.clearCookie(WORKOS_OAUTH_STATE_COOKIE_NAME, WORKOS_OAUTH_STATE_COOKIE_OPTIONS)

        if (!code) {
            if (req.query.error) {
                logger.warn("[/callback] WorkOS returned an error to the callback", { error: req.query.error })
            }
            res.status(400).send("No code provided")
            return
        }

        if (!state || !expectedState || state.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
            logger.warn("[/callback] OAuth state mismatch — possible CSRF or stale flow", { hasState: Boolean(state), hasExpectedState: Boolean(expectedState) })
            res.status(400).send("Invalid OAuth state")
            return
        }

        try {
            const authenticateResponse = await this.workos.userManagement.authenticateWithCode({
                clientId: this.config.clientId,
                code,
                session: {
                    sealSession: true,
                    cookiePassword: this.config.cookiePassword
                }
            })

            if (!authenticateResponse.sealedSession) {
                logger.error("[/callback] No sealed session in authenticate response")
                res.status(401).send("No sealed session provided")
                return
            }

            const workosSession = this.workos.userManagement.loadSealedSession({
                sessionData: authenticateResponse.sealedSession,
                cookiePassword: this.config.cookiePassword
            })
            const authResult = await workosSession.authenticate()

            if (!authResult.authenticated) {
                logger.warn("[/callback] Session authentication failed", { reason: (authResult as { reason?: string }).reason })
                res.status(401).send("Failed to authenticate")
                return
            }

            setSessionCookie(res, authenticateResponse.sealedSession)
            res.redirect(settings.urls.frontend)
            return
        } catch (error) {
            logger.error("[/callback] WorkOS callback error", {
                errorName: error instanceof Error ? error.name : "Unknown",
                errorMessage: extractErrorMessage(error),
                stack: error instanceof Error ? error.stack : undefined
            })

            clearSessionCookies(res)
            res.status(500).send(`Authentication failed. Please <a href="${settings.urls.frontend}">return to the app</a> and try again. If the problem persists, clear your cookies for this site.`)
            return
        }
    }

    async authenticateViaCookie(sealedSessionData: string | undefined, req: Request, res: Response): Promise<CookieAuthOutcome> {
        if (!sealedSessionData) {
            return { ok: false, reason: "no_cookie" }
        }

        try {
            const session = this.workos.userManagement.loadSealedSession({
                sessionData: sealedSessionData,
                cookiePassword: this.config.cookiePassword
            })
            const authResult = await session.authenticate()

            if (authResult.authenticated) {
                const claims = getClaimsFromAuthResult(authResult)
                const { user } = await buildUserFromWorkOS(this.workos, authResult, claims)
                return { ok: true, user }
            }

            if (authResult.reason === "no_session_cookie_provided") {
                return { ok: false, reason: "no_cookie" }
            }

            logger.info("Session expired, attempting refresh", { reason: authResult.reason })
            const refreshed = await session.refresh({ cookiePassword: this.config.cookiePassword })
            if (!refreshed.authenticated) {
                logger.warn("Session refresh failed")
                return { ok: false, reason: "auth_failed" }
            }
            const { user } = await buildUserFromWorkOS(this.workos, refreshed)
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

    async getWorkOSWidgetToken(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).send("Unauthorized")
            return
        }
        if (!user.organizationId) {
            res.status(400).send("User has no organization. Create an organization first.")
            return
        }

        const widgetToken = await this.workos.widgets.getToken({
            organizationId: user.organizationId,
            userId: user.id
        })
        res.json({ token: widgetToken })
    }

    async requestSessionSocketToken(req: Request, res: Response): Promise<void> {
        try {
            const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
            if (!sealedSessionData) {
                res.status(401).json({ error: "No session" })
                return
            }

            const session = this.workos.userManagement.loadSealedSession({
                sessionData: sealedSessionData,
                cookiePassword: this.config.cookiePassword
            })

            const authResult = await session.authenticate()
            if (!authResult.authenticated) {
                res.status(401).json({ error: "Invalid session" })
                return
            }

            res.json({ token: authResult.accessToken })
        } catch (error) {
            logger.error("Failed to request session socket token", { error })
            res.status(500).json({ error: "Failed to request session socket token" })
        }
    }
}
