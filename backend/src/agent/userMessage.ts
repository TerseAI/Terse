import { user } from "@openai/agents"
import type { AgentInputItem, UserMessageItem } from "@openai/agents-core"

import { createUnixTimestampId } from "../utility/strings"

export function createUserMessageItem(content: Parameters<typeof user>[0]): AgentInputItem {
    const item = user(content) as UserMessageItem
    item.id = createUnixTimestampId()
    return item as AgentInputItem
}
