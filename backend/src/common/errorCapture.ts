import { analytics } from "./analytics"

export function captureException(err: unknown, context?: { userId?: string; route?: string; [k: string]: unknown }): void {
    const client = analytics.getPostHogClient()
    if (!client) return
    const distinctId = context?.userId ?? "system"
    client.captureException(err, distinctId, context)
}
