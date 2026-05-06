import { TokenKind } from "@prisma/client"
import { NextFunction, Request, RequestHandler, Response } from "express"

import { clearSessionCookies } from "../routes/auth"

import { authenticateViaApiToken, authenticateViaCookie, readBearerToken, readSealedSessionCookie, validateCloudSchedulerHeader } from "./authDispatch"

export enum AuthKind {
    UserCookie = "user_cookie",
    UserToken = "user_token",
    ProjectToken = "project_token",
    CloudScheduler = "cloud_scheduler"
}

export interface AuthOptions {
    allowNoOrg?: boolean
}

export function requireAuth(allow: AuthKind[], opts: AuthOptions = {}): RequestHandler {
    if (allow.length === 0) {
        throw new Error("requireAuth() called with empty allow list — at least one AuthKind required")
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        const bearer = readBearerToken(req.headers.authorization)
        const cookie = readSealedSessionCookie(req.cookies)

        if (bearer) {
            return handleBearer(bearer, allow, opts, req, res, next)
        }

        if (cookie) {
            return handleCookie(cookie, allow, opts, req, res, next)
        }

        return sendUnauthorized(req, res)
    }
}

async function handleBearer(bearer: string, allow: AuthKind[], opts: AuthOptions, req: Request, res: Response, next: NextFunction) {
    if (bearer.startsWith("terse_")) {
        const result = await authenticateViaApiToken(bearer)
        if (!result.ok) {
            const status = result.reason === "expired" ? 401 : 401
            const message = result.reason === "expired" ? "API token has expired" : "Invalid API token"
            res.status(status).json({ error: message })
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
        return next()
    }

    if (allow.includes(AuthKind.CloudScheduler)) {
        if (validateCloudSchedulerHeader(req.headers.authorization)) {
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

    const result = await authenticateViaCookie(cookie, res)
    if (!result.ok) {
        clearSessionCookies(res)
        return sendUnauthorized(req, res)
    }

    if (!opts.allowNoOrg && !result.user.organizationId) {
        return sendOrganizationRequired(res)
    }

    req.session = { user: result.user, authMethod: { kind: "cookie" } }
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
