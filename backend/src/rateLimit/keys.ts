import { Request } from "express"

/**
 * Bucket-key extractors for rate limiters. Each returns `string` to key
 * against, or `null` to opt this request out entirely. Use a `null` return
 * sparingly — anonymous endpoints typically want `byIp` rather than skip.
 */

export const byIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? "unknown"

export const byUserId = (req: Request): string | null => req.session?.user?.id ?? null

export const byOrgId = (req: Request): string | null => req.session?.user?.organizationId ?? null

/** Factory: key against a URL param (e.g. webhook token, integration id). */
export const byParam =
    (name: string) =>
    (req: Request): string | null =>
        req.params[name] ?? null

/** Authenticated requests key by user id; anonymous fall back to IP. */
export const byUserOrIp = (req: Request): string => req.session?.user?.id ?? byIp(req)
