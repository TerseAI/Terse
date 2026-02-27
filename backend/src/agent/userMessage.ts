import { randomUUID } from "crypto"

import type { UserMessageItem } from "@openai/agents-core"

const MAX_USER_MESSAGE_ID_LENGTH = 63

function buildUserMessageId(): string {
    const id = `msg_${randomUUID()}`
    if (id.length <= MAX_USER_MESSAGE_ID_LENGTH) {
        return id
    }
    return id.slice(0, MAX_USER_MESSAGE_ID_LENGTH)
}

/**
 * Build a user message AgentInputItem with a stable ID format for dedupe.
 * ID format: msg_<uuid>, always shorter than 64 chars.
 */
export function buildUserMessage(text: string): UserMessageItem {
    return buildUserMessageFromContent([
        {
            type: "input_text",
            text
        }
    ])
}

/**
 * Build a user message AgentInputItem from pre-built content parts
 * (e.g. input_text + input_file/input_image attachments).
 */
export function buildUserMessageFromContent(content: UserMessageItem["content"]): UserMessageItem {
    const normalizedContent =
        typeof content === "string"
            ? [
                  {
                      type: "input_text" as const,
                      text: content
                  }
              ]
            : content

    return {
        type: "message",
        role: "user",
        id: buildUserMessageId(),
        content: normalizedContent
    }
}
