import express, { Router } from "express"
import { ApiRoutes } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"

import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

// Handlers still live in modules/triggers/schedule.ts and modules/triggers/webhookTrigger.ts.
// A future PR can decompose them into controller/service files within this folder.
import { handleManualTrigger, handleScheduleWebhook, handleTriggerWithEvent, handleWebMonitorWebhook } from "./schedule"
import { handleWebhookTrigger } from "./webhookTrigger"

const LARGE_BODY_LIMIT = "10mb"

const router = Router()
const userAuth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

// Manual triggers (authenticated)
router.post(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID, limit, userAuth, handleManualTrigger)
router.post(ApiRoutes.SCHEDULE.TRIGGER_WITH_EVENT, limit, userAuth, handleTriggerWithEvent)

// Webhook callbacks — bespoke auth (CloudScheduler for schedule, raw body for webmonitor, token for webhook trigger)
router.post(ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID, requireAuth([AuthKind.CloudScheduler]), handleScheduleWebhook)

if (INTEGRATION_REGISTRY.some(m => m.integrationType === IntegrationType.WEBMONITOR)) {
    router.use(
        ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID,
        rateLimit(RateLimitKind.WebhookByIp),
        express.raw({ type: "application/json", limit: LARGE_BODY_LIMIT })
    )
    router.post(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, handleWebMonitorWebhook)
}

router.post(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, rateLimit(RateLimitKind.WebhookByToken), handleWebhookTrigger)

export default router
