import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { DurableObjectMessageTrigger } from "terse-types/Triggers"
import { z } from "zod"

import { secretsMatch } from "../../common/crypto"
import logger, { runWithUserContext } from "../../common/logger"
import { TriggerRuntime } from "../../integrations/abstract/TriggerRuntime"
import { db } from "../../loaders/prisma"
import { settings } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { resolveUserInOrg } from "../../utility/identity"
import { EventProcessor } from "../agents/AgentRunner/EventProcessor"
import { readBearerToken } from "../auth/helpers/authDispatch"

const socketMessageEventSchema = z.object({
    eventId: z.string().uuid(),
    namespaceId: z.string().min(1),
    actorType: z.string().min(1),
    actorId: z.string().min(1),
    triggerId: z.string().min(1).optional(),
    connectionId: z.string().min(1),
    message: z.discriminatedUnion("type", [z.object({ type: z.literal("text"), data: z.string() }), z.object({ type: z.literal("binary"), data: z.string() })])
})

class DurableObjectMessageRuntime extends TriggerRuntime<DurableObjectMessageTrigger> {
    readonly integrationType = IntegrationType.TERSE
    readonly data: DurableObjectMessageTrigger

    constructor(event: z.infer<typeof socketMessageEventSchema>) {
        super()
        this.data = {
            integrationType: IntegrationType.TERSE,
            eventType: "durable_object.message",
            eventId: event.eventId,
            actorType: event.actorType,
            actorId: event.actorId,
            connectionId: event.connectionId,
            message: event.message
        }
    }

    matchesAgentTrigger(trigger: AgentTriggerWithConfigs): boolean {
        return trigger.config_type === InputConfigType.DURABLE_OBJECT_INPUT && trigger.integration_id === this.data.actorType
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: "durable_object.message",
            integration: IntegrationType.TERSE,
            source: "Durable Object",
            title: `${this.data.actorType}/${this.data.actorId}`,
            subheader: "WebSocket message"
        }
    }
}

export async function handleDurableObjectMessage(req: Request, res: Response): Promise<void> {
    const expected = settings.durableObjects?.socketEventToken
    const token = readBearerToken(req.headers.authorization)
    if (!expected || !token || !secretsMatch(token, expected)) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const parsed = socketMessageEventSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid durable object message event" })
        return
    }
    const inputs = await db().automation_inputs.findMany({
        where: {
            ...(parsed.data.triggerId ? { id: parsed.data.triggerId } : {}),
            config_type: InputConfigType.DURABLE_OBJECT_INPUT,
            integration_id: parsed.data.actorType,
            automation: { project_id: parsed.data.namespaceId, is_active: true }
        },
        include: { automation: true }
    })
    await Promise.all(
        inputs.map(async input => {
            const automation = input.automation
            const user = await resolveUserInOrg(automation.user_id, automation.organization_id)
            if (!user) {
                logger.warn("Durable Object trigger user was not found", { automationId: automation.id })
                return
            }
            await runWithUserContext(user, async () => {
                await new EventProcessor(new DurableObjectMessageRuntime(parsed.data), user).processSingleAgent(automation.id)
            })
        })
    )
    res.status(202).json({ received: true, triggered: inputs.length })
}
