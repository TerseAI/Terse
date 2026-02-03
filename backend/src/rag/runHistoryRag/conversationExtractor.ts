import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, FunctionCallResultItem, ReasoningItem, SystemMessageItem, UserMessageItem } from "@openai/agents-core"

// Type guard functions using the actual types from the library
function isUserMessageItem(event: AgentInputItem): event is UserMessageItem {
    return typeof event === "object" && event !== null && "role" in event && event.role === "user"
}

function isAssistantMessageItem(event: AgentInputItem): event is AssistantMessageItem {
    return typeof event === "object" && event !== null && "role" in event && event.role === "assistant"
}

function isSystemMessageItem(event: AgentInputItem): event is SystemMessageItem {
    return typeof event === "object" && event !== null && "role" in event && event.role === "system"
}

function isFunctionCallItem(event: AgentInputItem): event is FunctionCallItem {
    return typeof event === "object" && event !== null && "type" in event && event.type === "function_call"
}

function isFunctionCallResultItem(event: AgentInputItem): event is FunctionCallResultItem {
    return typeof event === "object" && event !== null && "type" in event && event.type === "function_call_result"
}

function isReasoningItem(event: AgentInputItem): event is ReasoningItem {
    if (typeof event !== "object" || event === null) return false

    if ("type" in event && event.type === "reasoning") return true

    // Check for reasoning items by ID pattern (rs_ prefix)
    if ("id" in event && typeof event.id === "string" && event.id.startsWith("rs_")) {
        return true
    }

    return false
}

// Helper function to extract text from message content
function extractTextFromMessageContent(content: UserMessageItem["content"] | AssistantMessageItem["content"] | SystemMessageItem["content"]): string {
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .filter((part): part is { type: "input_text" | "output_text"; text: string } => (part.type === "input_text" || part.type === "output_text") && "text" in part)
            .map(part => part.text)
            .join(" ")
    }

    return ""
}

// Helper function to extract text from reasoning content
function extractTextFromReasoningContent(content: ReasoningItem["content"]): string {
    return content
        .filter((part): part is { type: "input_text"; text: string } => part.type === "input_text" && "text" in part)
        .map(part => part.text)
        .join(" ")
}

// Helper function to extract text from function call result output
function extractTextFromFunctionResultOutput(output: FunctionCallResultItem["output"]): string {
    if (typeof output === "string") {
        return output
    }

    if (typeof output === "object" && output !== null) {
        if ("type" in output && output.type === "text" && "text" in output) {
            return output.text
        }
        return JSON.stringify(output)
    }

    return ""
}

// Helper function to extract role from event
function extractRole(event: AgentInputItem): string {
    if (isUserMessageItem(event)) return "user"
    if (isAssistantMessageItem(event)) return "assistant"
    if (isSystemMessageItem(event)) return "system"
    if (isFunctionCallItem(event)) return "function_call"
    if (isFunctionCallResultItem(event)) return "function_result"
    if (isReasoningItem(event)) return "reasoning"
    return "unknown"
}

/**
 * Extracts searchable text content from AgentInputItem conversation events.
 * This preserves the semantic meaning of conversations for embedding.
 */
export function extractConversationContent(event: AgentInputItem): string {
    // Handle user messages
    if (isUserMessageItem(event)) {
        return extractTextFromMessageContent(event.content)
    }

    // Handle assistant messages
    if (isAssistantMessageItem(event)) {
        return extractTextFromMessageContent(event.content)
    }

    // Handle system messages
    if (isSystemMessageItem(event)) {
        return extractTextFromMessageContent(event.content)
    }

    // Handle function calls
    if (isFunctionCallItem(event)) {
        const funcName = event.name || ""
        const args = event.arguments || ""
        const argsStr = typeof args === "string" ? args : JSON.stringify(args)
        return `Tool call: ${funcName} with arguments: ${argsStr}`
    }

    // Handle function call results
    if (isFunctionCallResultItem(event)) {
        const output = extractTextFromFunctionResultOutput(event.output)
        return output ? `Tool result: ${output}` : "Tool result: (empty)"
    }

    // Handle reasoning items
    if (isReasoningItem(event)) {
        const content = extractTextFromReasoningContent(event.content)
        return content || ""
    }

    // Fallback: stringify the whole event
    return JSON.stringify(event)
}

/**
 * Extract a conversation context window around an event.
 * Useful for creating richer searchable content that includes surrounding context.
 */
export function extractConversationWithContext(events: AgentInputItem[], eventIndex: number, contextWindow: number = 2): string {
    const start = Math.max(0, eventIndex - contextWindow)
    const end = Math.min(events.length, eventIndex + contextWindow + 1)
    const contextEvents = events.slice(start, end)

    return contextEvents
        .map(event => {
            const content = extractConversationContent(event)
            const role = extractRole(event)
            return `[${role}]: ${content}`
        })
        .join("\n")
}
