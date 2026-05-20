import { type ConnectionCapOptions, type RateLimitOptions } from "./RateLimiterClient"
import { byIp, byParam, byUserOrIp } from "./keys"

/**
 * Shared rate-limit configurations. Materialized into actual middleware
 * inside `startServer` after `RateLimiterClient.init()` resolves — keeping
 * these as plain options objects avoids any module-load-time work and
 * keeps the presets ordering-independent from server startup.
 *
 * AUTHED_DEFAULT is intentionally generous: the goal is to stop clear
 * abuse, not to throttle legitimate users. Tune per-route if a specific
 * endpoint needs tighter limits.
 */
export const RATE_LIMITS = {
    WEBHOOK_BY_TOKEN: { name: "webhook-by-token", points: 30, duration: 60, keyBy: byParam("webhookToken") },
    WEBHOOK_BY_IP: { name: "webhook-by-ip", points: 60, duration: 60, keyBy: byIp },
    HEYREACH_BY_TRIGGER: { name: "heyreach-by-trigger", points: 60, duration: 60, keyBy: byParam("triggerId") },
    TOKEN_MINTING: { name: "token-minting", points: 5, duration: 3600, blockDuration: 3600, keyBy: byUserOrIp },
    AUTHED_DEFAULT: { name: "authed-default", points: 500, duration: 60, keyBy: byUserOrIp }
} as const satisfies Record<string, RateLimitOptions>

export const CONNECTION_CAPS = {
    SSE_SESSION: { name: "sse-session", max: 5, keyTtlSeconds: 120, heartbeatIntervalMs: 30_000 }
} as const satisfies Record<string, ConnectionCapOptions>
