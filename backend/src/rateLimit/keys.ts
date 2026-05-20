import { Request } from "express"

export const byIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? "unknown"

export const byUserId = (req: Request): string | null => req.session?.user?.id ?? null

export const byOrgId = (req: Request): string | null => req.session?.user?.organizationId ?? null

export const byParam =
    (name: string) =>
    (req: Request): string | null =>
        req.params[name] ?? null

export const byUserOrIp = (req: Request): string => req.session?.user?.id ?? byIp(req)
