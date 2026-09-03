import express, { Router } from "express"
import { ApiRoutes } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"

import { IntegrationRegistry } from "../../integrations/abstract/IntegrationRegistry"
import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { handleDurableObjectMessage } from "./durableObjectMessage"
import { handleAuthorizeDurableObjectSocket, handleCreateDurableObjectSocketTicket, handleRotateDurableObjectSocketKey } from "./durableObjectSockets"
// Handlers still live in modules/triggers/schedule.ts and modules/triggers/webhookTrigger.ts.
// A future PR can decompose them into controller/service files within this folder.
import { handleManualTrigger, handleTriggerWithEvent, handleWebMonitorWebhook } from "./schedule"
import { handleWebhookTrigger } from "./webhookTrigger"

const LARGE_BODY_LIMIT = "10mb"

const router = Router()
const userAuth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const socketTicketAuth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const limit = rateLimit(RateLimitKind.Default)

// Manual triggers (authenticated)
router.post(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID, limit, userAuth, handleManualTrigger)
router.post(ApiRoutes.SCHEDULE.TRIGGER_WITH_EVENT, limit, userAuth, handleTriggerWithEvent)
router.post(ApiRoutes.DURABLE_OBJECTS.SOCKET_TICKETS, limit, socketTicketAuth, handleCreateDurableObjectSocketTicket)
router.post(ApiRoutes.DURABLE_OBJECTS.ROTATE_SOCKET_KEY, limit, userAuth, handleRotateDurableObjectSocketKey)
router.post(ApiRoutes.DURABLE_OBJECTS.AUTHORIZE_SOCKET, limit, handleAuthorizeDurableObjectSocket)

// Webhook callbacks — bespoke auth (raw body for webmonitor, token for webhook trigger)
if (
    IntegrationRegistry.getInstance()
        .all()
        .some(m => m.integrationType === IntegrationType.WEBMONITOR)
) {
    router.use(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, rateLimit(RateLimitKind.WebhookByIp), express.raw({ type: "application/json", limit: LARGE_BODY_LIMIT }))
    router.post(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, rateLimit(RateLimitKind.WebhookByIp), handleWebMonitorWebhook)
}

router.post(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, rateLimit(RateLimitKind.WebhookByToken), handleWebhookTrigger)
router.post(ApiRoutes.WEBHOOKS.DURABLE_OBJECT_MESSAGE, limit, handleDurableObjectMessage)

export default router
