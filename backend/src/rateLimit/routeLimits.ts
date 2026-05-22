import { RequestHandler } from "express"

import { RateLimitOptions, RateLimiterClient } from "./RateLimiterClient"
import { byIp, byParam, byUserOrIp } from "./keys"

export enum RateLimitKind {
    Default = "default",
    AuthEndpoint = "auth_endpoint",
    Identify = "identify",
    TokenMinting = "token_minting",
    SessionToken = "session_token",
    WebhookByToken = "webhook_by_token",
    WebhookByIp = "webhook_by_ip",
    HeyReachByTrigger = "heyreach_by_trigger"
}

export function rateLimit(kind: RateLimitKind): RequestHandler {
    return (req, res, next) => {
        const routePath = req.route?.path
        if (!routePath) {
            // Defensive: skip rather than rate-limit the wrong bucket if
            // somehow invoked outside a matched route.
            return next()
        }
        const cacheKey = `${kind}:${routePath}`
        let handler = handlerCache.get(cacheKey)
        if (!handler) {
            handler = RateLimiterClient.getInstance().createLimiter({
                name: cacheKey,
                ...PROFILES[kind]
            })
            handlerCache.set(cacheKey, handler)
        }
        return handler(req, res, next)
    }
}

const PROFILES: Record<RateLimitKind, Omit<RateLimitOptions, "name">> = {
    [RateLimitKind.Default]: { points: 120, duration: 60, keyBy: byUserOrIp },
    [RateLimitKind.AuthEndpoint]: { points: 20, duration: 60, keyBy: byIp },
    [RateLimitKind.Identify]: { points: 10, duration: 60, keyBy: byIp },
    [RateLimitKind.TokenMinting]: { points: 5, duration: 3600, blockDuration: 3600, keyBy: byUserOrIp },
    [RateLimitKind.SessionToken]: { points: 30, duration: 60, keyBy: byUserOrIp },
    [RateLimitKind.WebhookByToken]: { points: 100, duration: 60, keyBy: byParam("webhookToken") },
    [RateLimitKind.WebhookByIp]: { points: 300, duration: 60, keyBy: byIp },
    [RateLimitKind.HeyReachByTrigger]: { points: 60, duration: 60, keyBy: byParam("triggerId") }
}

const handlerCache = new Map<string, RequestHandler>()
