import crypto from "crypto"
import { Request, Response } from "express"
import { User } from "terse-types/types"

import logger from "../../common/logger"
import { extractErrorMessage } from "../../common/strings"
import { GithubIntegrationManager } from "../../integrations/github/integration"
import { workos } from "../../integrations/workos/helpers"
import { getClaimsFromAuthResult } from "../../modules/auth/helpers/accessTokenClaims"
import { settings } from "../../settings"

import {
    WORKOS_OAUTH_STATE_COOKIE_NAME,
    WORKOS_OAUTH_STATE_COOKIE_OPTIONS,
    WORKOS_SESSION_COOKIE_NAME,
    buildWorkOSLoginUrl,
    clearSessionCookies,
    getOrCreateDbUserFromWorkOS,
    getPostLogoutRedirectUrl,
    getWorkOSLogoutUrl,
    setSessionCookie,
    shouldRedirectToLogin
} from "./service"

export async function login(_req: Request, res: Response) {
    const authorizationUrl = buildWorkOSLoginUrl(res)
    res.redirect(authorizationUrl)
}

export async function loginUrl(_req: Request, res: Response) {
    const authorizationUrl = buildWorkOSLoginUrl(res)
    return res.json({ loginUrl: authorizationUrl })
}

export async function logoutUrl(req: Request, res: Response) {
    const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
    const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
    clearSessionCookies(res)

    try {
        const workosLogoutUrl = await getWorkOSLogoutUrl(sealedSessionData, postLogoutRedirectUrl)
        return res.json({ logoutUrl: workosLogoutUrl ?? postLogoutRedirectUrl })
    } catch (error) {
        logger.warn("[/logout/url] Failed to build WorkOS logout URL, falling back to post-logout redirect", { error, postLogoutRedirectUrl })
        return res.json({ logoutUrl: postLogoutRedirectUrl })
    }
}

export async function logout(req: Request, res: Response) {
    const redirectToLogin = shouldRedirectToLogin(req.query.redirectToLogin)
    const postLogoutRedirectUrl = getPostLogoutRedirectUrl(redirectToLogin)
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
    clearSessionCookies(res)

    try {
        const workosLogoutUrl = await getWorkOSLogoutUrl(sealedSessionData, postLogoutRedirectUrl)
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

export async function me(req: Request, res: Response) {
    const user = req.session?.user || null
    if (!user) return res.status(401).send("Unauthorized")

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
        logger.warn("[/me] Failed to fetch fresh user from WorkOS, returning session user", { error: extractErrorMessage(error) })
        return res.send(user)
    }
}

export async function callback(req: Request, res: Response) {
    const code = req.query.code as string
    const state = typeof req.query.state === "string" ? req.query.state : undefined
    const expectedState = req.cookies?.[WORKOS_OAUTH_STATE_COOKIE_NAME] as string | undefined

    res.clearCookie(WORKOS_OAUTH_STATE_COOKIE_NAME, WORKOS_OAUTH_STATE_COOKIE_OPTIONS)

    if (!code) {
        if (req.query.error) {
            logger.warn("[/callback] WorkOS returned an error to the callback", { error: req.query.error })
        }
        return res.status(400).send("No code provided")
    }

    if (!state || !expectedState || state.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
        logger.warn("[/callback] OAuth state mismatch — possible CSRF or stale flow", { hasState: Boolean(state), hasExpectedState: Boolean(expectedState) })
        return res.status(400).send("Invalid OAuth state")
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
            logger.warn("[/callback] Session authentication failed", { reason: (authResult as { reason?: string }).reason })
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

        clearSessionCookies(res)
        return res.status(500).send(`Authentication failed. Please <a href="${settings.urls.frontend}">return to the app</a> and try again. If the problem persists, clear your cookies for this site.`)
    }
}

export async function getWorkOSWidgetToken(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.organizationId) return res.status(400).json({ error: "User has no organization. Create an organization first." })
    if (!user.workosId) return res.status(400).json({ error: "User has no WorkOS ID. Re-authenticate to link account." })

    const widgetToken = await workos.widgets.getToken({
        organizationId: user.organizationId,
        userId: user.workosId
    })
    return res.json({ token: widgetToken })
}

export async function githubAppCallbackIntegrate(req: Request, res: Response) {
    logger.info("Github App OAuth callback received", { query: req.query })
    const { code, state } = req.query as { code?: string; state?: string }
    if (!code || !state) {
        return res.status(400).send("Invalid OAuth state")
    }

    const integration = new GithubIntegrationManager()
    await integration.processInstallationCallback(req, res)
}
