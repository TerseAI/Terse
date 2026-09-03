import { ApiRoutes, buildRoute } from "terse-types"

import { settings } from "../settings"

export function buildDurableObjectSocketUrl(triggerId: string, actorId: string): string {
    const gatewayUrl = settings.durableObjects?.socketGatewayUrl
    if (!gatewayUrl) throw new Error("Durable Object socket gateway is not configured")
    const url = new URL(gatewayUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = buildRoute(ApiRoutes.DURABLE_OBJECTS.GATEWAY_SOCKET, { triggerId, actorId })
    return url.href
}

export function buildDurableObjectSocketUrlTemplate(triggerId: string): string {
    return buildDurableObjectSocketUrl(triggerId, "ACTOR_ID").replace("ACTOR_ID", "{actorId}")
}
