import { TokenKind } from "@prisma/client"
import { NextFunction, Request, RequestHandler, Response } from "express"
import type { UserSession } from "terse-types/types"

import { clearSessionCookies } from "../../../ee/services/authProvider/service"

import { authenticateViaApiToken, authenticateViaCookie, readBearerToken, readSealedSessionCookie, validateCloudSchedulerHeader } from "./authDispatch"

export enum AuthKind {
    UserCookie = "user_cookie",
    UserToken = "user_token",
    ProjectToken = "project_token",
    CloudScheduler = "cloud_scheduler"
}

export interface AuthOptions {
    allowNoOrg?: boolean
    requireAdmin?: boolean
}

export function requireAuth(allow: AuthKind[], opts: AuthOptions = { allowNoOrg: false, requireAdmin: false }): RequestHandler {
    if (allow.length === 0) {
        throw new Error("requireAuth() called with empty allow list — at least one AuthKind required")
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        const bearer = readBearerToken(req.headers.authorization)
        const cookie = readSealedSessionCookie(req.cookies)

        const bearerWanted = bearer !== null && allow.some(k => CREDENTIAL_CHANNEL[k] === "bearer")
        const cookieWanted = cookie !== undefined && allow.some(k => CREDENTIAL_CHANNEL[k] === "cookie")

        if (bearerWanted) {
            return handleBearer(bearer!, allow, opts, req, res, next)
        }

        if (cookieWanted) {
            return handleCookie(cookie!, allow, opts, req, res, next)
        }

        return sendUnauthorized(req, res)
    }
}

type CredentialChannel = "bearer" | "cookie"

const CREDENTIAL_CHANNEL: Record<AuthKind, CredentialChannel> = {
    [AuthKind.UserCookie]: "cookie",
    [AuthKind.UserToken]: "bearer",
    [AuthKind.ProjectToken]: "bearer",
    [AuthKind.CloudScheduler]: "bearer"
}

async function handleBearer(bearer: string, allow: AuthKind[], opts: AuthOptions, req: Request, res: Response, next: NextFunction) {
    if (bearer.startsWith("terse_")) {
        const result = await authenticateViaApiToken(bearer)
        if (!result.ok) {
            const message = result.reason === "expired" ? "API token has expired" : "Invalid API token"
            res.status(401).json({ error: message })
            return
        }

        const authKind = tokenKindToAuthKind(result.tokenKind)
        if (!allow.includes(authKind)) {
            res.status(403).json({ error: "This route does not accept this credential type" })
            return
        }

        if (!opts.allowNoOrg && !result.user.organizationId) {
            return sendOrganizationRequired(res)
        }

        req.session = { user: result.user, authMethod: { kind: "api_token", tokenKind: result.tokenKind } }
        if (!assertAdminIfRequired(opts, result.user, res)) return
        return next()
    }

    if (allow.includes(AuthKind.CloudScheduler)) {
        if (validateCloudSchedulerHeader(req.headers.authorization)) {
            if (opts.requireAdmin) {
                res.status(403).json({ error: "Only organization admins can perform this action" })
                return
            }
            return next()
        }
        res.status(401).json({ error: "Invalid scheduler credential" })
        return
    }

    res.status(401).json({ error: "Invalid credential" })
}

async function handleCookie(cookie: string, allow: AuthKind[], opts: AuthOptions, req: Request, res: Response, next: NextFunction) {
    if (!allow.includes(AuthKind.UserCookie)) {
        res.status(403).json({ error: "This route does not accept browser sessions" })
        return
    }

    const result = await authenticateViaCookie(cookie, req, res)
    if (!result.ok) {
        clearSessionCookies(res)
        return sendUnauthorized(req, res)
    }

    if (!opts.allowNoOrg && !result.user.organizationId) {
        return sendOrganizationRequired(res)
    }

    req.session = { user: result.user, authMethod: { kind: "cookie" } }
    if (!assertAdminIfRequired(opts, result.user, res)) return
    return next()
}

function tokenKindToAuthKind(kind: TokenKind): AuthKind {
    switch (kind) {
        case TokenKind.USER:
            return AuthKind.UserToken
        case TokenKind.PROJECT:
            return AuthKind.ProjectToken
    }
}

function sendUnauthorized(req: Request, res: Response) {
    const acceptsJson = (req.get("accept") || "").includes("application/json")
    if (acceptsJson) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    res.redirect("/login")
}

function sendOrganizationRequired(res: Response) {
    res.status(403).json({
        code: "ORGANIZATION_REQUIRED",
        message: "User must create or join an organization",
        redirectTo: "/organization/create"
    })
}

function assertAdminIfRequired(opts: AuthOptions, user: UserSession, res: Response): boolean {
    if (!opts.requireAdmin) return true
    if (!user.roles?.includes("admin")) {
        res.status(403).json({ error: "Only organization admins can perform this action" })
        return false
    }
    return true
}
