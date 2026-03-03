import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { randomString } from "../../utility/strings"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToBuilderSession } from "./systemEventSessions"

const templatePromptSystemEventPayloadSchema = z.object({
    kind: z.literal("template_prompt"),
    id: z.string().trim().min(1).optional(),
    template_id: z.string().trim().min(1),
    prompt_text: z.string().trim().min(1)
})

type TemplatePromptSystemEventPayload = z.infer<typeof templatePromptSystemEventPayloadSchema>

export type ParsedTemplatePromptSystemEvent = {
    templateId: string
    promptText: string
}

class TemplatePromptSystemEvent extends BaseSystemEvent<TemplatePromptSystemEventPayload, ParsedTemplatePromptSystemEvent> {
    constructor() {
        super(templatePromptSystemEventPayloadSchema)
    }

    protected decodePayload(payload: TemplatePromptSystemEventPayload): ParsedTemplatePromptSystemEvent | null {
        return {
            templateId: payload.template_id,
            promptText: payload.prompt_text
        }
    }
}

const templatePromptSystemEvent = new TemplatePromptSystemEvent()

function buildPayload(templateId: string, promptText: string): TemplatePromptSystemEventPayload {
    return {
        kind: "template_prompt",
        id: `msg_template_prompt-${templateId}-${randomString(8)}`,
        template_id: templateId,
        prompt_text: promptText
    }
}

export function buildTemplatePromptSystemEventItem(templateId: string, promptText: string): AgentInputItem {
    return templatePromptSystemEvent.createItem(buildPayload(templateId, promptText))
}

export function parseTemplatePromptSystemEventItem(item: unknown): ParsedTemplatePromptSystemEvent | null {
    return templatePromptSystemEvent.parseItem(item)
}

export async function appendBuilderChatTemplatePromptSystemEvent(
    sessionId: string,
    templateId: string,
    promptText: string
): Promise<void> {
    await appendSystemEventToBuilderSession(sessionId, buildTemplatePromptSystemEventItem(templateId, promptText))
}
