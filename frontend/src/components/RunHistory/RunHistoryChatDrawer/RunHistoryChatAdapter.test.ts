import { describe, expect, it } from "vitest"

import { EntityType } from "@/shared/Entities"
import { ChangeEventType, ToolCallExecutionStatus } from "@/shared/ModelEvents"
import type { ModelEvent } from "@/shared/ModelEvents"

import { convertRunHistoryEventsToTurns } from "./runHistoryEventsToTurns"

type EventWithTimestamp = ModelEvent & { timestamp?: number }

/**
 * ToolCallGenerating has no handler and is silently ignored.
 * If run history API ever includes it, we need to add a handler.
 */
describe("convertRunHistoryEventsToTurns", () => {
    it("returns empty array for empty events", () => {
        const turns = convertRunHistoryEventsToTurns([])
        expect(turns).toEqual([])
    })

    it("converts UserMessage to a user turn", () => {
        const events: EventWithTimestamp[] = [{ type: "UserMessage", message: "Hello, world!" }]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0]).toMatchObject({
            role: "user",
            text: "Hello, world!",
            step_id: "user",
            isGenerating: false
        })
    })

    it("converts TextDelta to an assistant turn with accumulated text", () => {
        const events: EventWithTimestamp[] = [
            { type: "TextDelta", delta: "Hello", step_id: "step-1" },
            { type: "TextDelta", delta: " world", step_id: "step-1" }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0]).toMatchObject({
            role: "assistant",
            text: "Hello world",
            step_id: "step-1"
        })
    })

    it("converts UserMessage followed by TextDelta to separate turns", () => {
        const events: EventWithTimestamp[] = [
            { type: "UserMessage", message: "Hi" },
            { type: "TextDelta", delta: "Hi there!", step_id: "step-1" }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(2)
        expect(turns[0]).toMatchObject({ role: "user", text: "Hi" })
        expect(turns[1]).toMatchObject({ role: "assistant", text: "Hi there!" })
    })

    it("converts ToolCall to assistant turn with function call", () => {
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCall",
                step_id: "call-1",
                summary: "search_database",
                parameters: '{"query":"test"}',
                integration: "db"
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0].role).toBe("assistant")
        expect(turns[0].function_calls).toHaveLength(1)
        expect(turns[0].function_calls[0]).toMatchObject({
            id: "call-1",
            name: "search_database",
            parameters: '{"query":"test"}',
            isRunning: false
        })
    })

    it("converts ToolCall + ToolCallComplete to completed function call", () => {
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCall",
                step_id: "call-1",
                summary: "search",
                parameters: "{}",
                integration: "db"
            },
            {
                type: "ToolCallComplete",
                step_id: "call-1",
                tool_name: "search",
                status: ToolCallExecutionStatus.COMPLETED,
                changed_items: [],
                integration: "db",
                result: "Found 3 items"
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        const fc = turns[0].function_calls[0]
        expect(fc.name).toBe("search")
        expect(fc.result).toBe("Found 3 items")
        expect(fc.isRunning).toBe(false)
    })

    it("converts FilterResult to assistant turn with filter_result", () => {
        const events: EventWithTimestamp[] = [
            {
                type: "FilterResult",
                step_id: "filter-1",
                isRelevant: true,
                reason: "User asked about tickets",
                confidence: 0.95
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0]).toMatchObject({
            role: "assistant",
            step_id: "filter",
            filter_result: {
                isRelevant: true,
                reason: "User asked about tickets",
                confidence: 0.95
            }
        })
    })

    it("converts RunError to assistant turn with error", () => {
        const events: EventWithTimestamp[] = [{ type: "RunError", error: "Context window exceeded", code: "context_length_exceeded" }]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0]).toMatchObject({
            role: "assistant",
            text: "Context window exceeded",
            step_id: "run-error",
            isFailure: true,
            errorCode: "context_length_exceeded"
        })
    })

    it("marks historical turns as not generating", () => {
        const events: EventWithTimestamp[] = [
            { type: "UserMessage", message: "Hi" },
            { type: "TextDelta", delta: "Hello!", step_id: "step-1" },
            { type: "NaturalStop", step_id: "step-1" }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns[1].isGenerating).toBe(false)
    })

    it("handles ToolCallComplete without preceding ToolCall (orphan complete)", () => {
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCallComplete",
                step_id: "orphan-call",
                tool_name: "orphan_tool",
                status: ToolCallExecutionStatus.COMPLETED,
                changed_items: [],
                integration: "test",
                result: "done"
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0].function_calls[0]).toMatchObject({
            id: "orphan-call",
            name: "orphan_tool",
            result: "done"
        })
    })

    it("converts ToolCallComplete with errorContext to failed function call", () => {
        const errorObj = new Error("Something broke")
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCall",
                step_id: "call-1",
                summary: "search",
                parameters: "{}",
                integration: "db"
            },
            {
                type: "ToolCallComplete",
                step_id: "call-1",
                tool_name: "search",
                status: ToolCallExecutionStatus.FAILED,
                changed_items: [],
                integration: "db",
                errorContext: { error: errorObj }
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        const fc = turns[0].function_calls[0]
        expect(fc.isFailure).toBe(true)
        expect(fc.errorContext).toEqual({ error: errorObj })
    })

    it("propagates changed_items from ToolCallComplete to function call", () => {
        const changedItems = [
            {
                type_name: EntityType.TICKET,
                id: "ticket-123",
                change_event_type: ChangeEventType.CREATED
            }
        ]
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCall",
                step_id: "call-1",
                summary: "create_ticket",
                parameters: "{}",
                integration: "jira"
            },
            {
                type: "ToolCallComplete",
                step_id: "call-1",
                tool_name: "create_ticket",
                status: ToolCallExecutionStatus.COMPLETED,
                changed_items: changedItems,
                integration: "jira",
                result: "Created TICKET-123"
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0].function_calls[0].changed_items).toEqual(changedItems)
    })

    describe("Thinking event", () => {
        it("filters out thinking-only turn when followed by TextDelta and clears isThinking", () => {
            const events: EventWithTimestamp[] = [
                { type: "Thinking", step_id: "step-1" },
                { type: "TextDelta", delta: "Here is the answer.", step_id: "step-1" }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0]).toMatchObject({
                role: "assistant",
                text: "Here is the answer.",
                step_id: "step-1"
            })
            expect(turns[0].isThinking).toBe(false)
        })

        it("keeps thinking turn when it is the last turn (still thinking)", () => {
            const events: EventWithTimestamp[] = [{ type: "Thinking", step_id: "step-1" }]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].isThinking).toBe(true)
        })

        it("filters out thinking-only turn when followed by ToolCall", () => {
            const events: EventWithTimestamp[] = [
                { type: "Thinking", step_id: "step-1" },
                {
                    type: "ToolCall",
                    step_id: "call-1",
                    summary: "search",
                    parameters: "{}",
                    integration: "db"
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].function_calls).toHaveLength(1)
        })
    })

    it("creates separate assistant turns for TextDelta with different step_ids", () => {
        const events: EventWithTimestamp[] = [
            { type: "TextDelta", delta: "First message", step_id: "step-1" },
            { type: "TextDelta", delta: "Second message", step_id: "step-2" }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(2)
        expect(turns[0]).toMatchObject({ text: "First message", step_id: "step-1" })
        expect(turns[1]).toMatchObject({ text: "Second message", step_id: "step-2" })
    })

    it("puts multiple tool calls in the same assistant turn", () => {
        const events: EventWithTimestamp[] = [
            {
                type: "ToolCall",
                step_id: "call-1",
                summary: "search",
                parameters: "{}",
                integration: "db"
            },
            {
                type: "ToolCall",
                step_id: "call-2",
                summary: "create_ticket",
                parameters: "{}",
                integration: "jira"
            }
        ]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(1)
        expect(turns[0].function_calls).toHaveLength(2)
        expect(turns[0].function_calls[0]).toMatchObject({ id: "call-1", name: "search" })
        expect(turns[0].function_calls[1]).toMatchObject({ id: "call-2", name: "create_ticket" })
    })

    describe("RunError", () => {
        it("handles RunError without code (errorCode omitted)", () => {
            const events: EventWithTimestamp[] = [{ type: "RunError", error: "Something went wrong" }]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0]).toMatchObject({
                role: "assistant",
                text: "Something went wrong",
                step_id: "run-error",
                isFailure: true
            })
            expect(turns[0].errorCode).toBeUndefined()
        })

        it("stops previous turn when RunError arrives after other turns", () => {
            const events: EventWithTimestamp[] = [
                { type: "UserMessage", message: "Hi" },
                { type: "TextDelta", delta: "Thinking...", step_id: "step-1" },
                { type: "RunError", error: "Context window exceeded" }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(3)
            expect(turns[1].isGenerating).toBe(false)
            expect(turns[2]).toMatchObject({
                role: "assistant",
                text: "Context window exceeded",
                step_id: "run-error",
                isFailure: true
            })
        })
    })

    /**
     * ToolCallGenerating and Snippet are in ModelEvent but have no handlers in
     * convertRunHistoryEventsToTurns. They are silently ignored.
     * Run history API may not include these events; if it does, consider adding handlers.
     */
    it("ignores ToolCallGenerating events (no handler)", () => {
        const events: EventWithTimestamp[] = [{ type: "ToolCallGenerating", tool_name: "search", step_id: "call-1" }]
        const turns = convertRunHistoryEventsToTurns(events)
        expect(turns).toHaveLength(0)
    })

    describe("Snippet", () => {
        it("adds snippet to last assistant turn", () => {
            const events: EventWithTimestamp[] = [
                { type: "UserMessage", message: "Hi" },
                { type: "TextDelta", delta: "Here's a link:", step_id: "step-1" },
                {
                    type: "Snippet",
                    snippet: { type: "button", label: "Open", url: "https://example.com" }
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(2)
            expect(turns[1].snippets).toHaveLength(1)
            expect(turns[1].snippets![0]).toMatchObject({
                type: "button",
                label: "Open",
                url: "https://example.com"
            })
            expect(turns[1].snippets![0].id).toBeDefined()
        })

        it("creates new assistant turn when snippet arrives with no assistant turn", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "Snippet",
                    snippet: { type: "button", label: "Open", url: "https://example.com" }
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].snippets).toHaveLength(1)
            expect(turns[0].snippets![0]).toMatchObject({
                type: "button",
                label: "Open",
                url: "https://example.com"
            })
        })
    })

    describe("approval flow", () => {
        it("handles standard order: ToolApprovalRequest → ToolApprovalResponse → ToolCallComplete (no ToolCall)", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolApprovalRequest",
                    step_id: "call_qoeOG2BKJqz0EBTIXizbLw42",
                    name: "slack_send_message",
                    arguments: '{"channelId":"C0286VDFH46","message":"Weekly digest"}'
                },
                {
                    type: "ToolApprovalResponse",
                    step_id: "call_qoeOG2BKJqz0EBTIXizbLw42",
                    approved: false
                },
                {
                    type: "ToolCallComplete",
                    step_id: "call_qoeOG2BKJqz0EBTIXizbLw42",
                    tool_name: "slack_send_message",
                    status: ToolCallExecutionStatus.COMPLETED,
                    changed_items: [],
                    integration: "terse",
                    result: "Tool execution was not approved."
                },
                {
                    type: "TextDelta",
                    delta: "I'm blocked on Slack posting approval.",
                    step_id: "msg_0a68447d5cc0ef45006998669a16488197a9f8c7e3fb641097"
                },
                { type: "NaturalStop", step_id: "historical-stop" }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(2)
            const toolTurn = turns[0]
            expect(toolTurn.function_calls[0]).toMatchObject({
                id: "call_qoeOG2BKJqz0EBTIXizbLw42",
                name: "slack_send_message",
                isApproved: false,
                isRejected: true,
                isWaitingForApproval: false,
                result: "Tool execution was not approved."
            })
            expect(turns[1]).toMatchObject({
                role: "assistant",
                text: "I'm blocked on Slack posting approval.",
                step_id: "msg_0a68447d5cc0ef45006998669a16488197a9f8c7e3fb641097"
            })
        })

        it("handles ToolApprovalRequest by itself (no preceding ToolCall)", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolApprovalRequest",
                    step_id: "approval-1",
                    name: "delete_file",
                    arguments: '{"path":"/tmp/foo"}'
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].function_calls[0]).toMatchObject({
                id: "approval-1",
                name: "delete_file",
                parameters: '{"path":"/tmp/foo"}',
                isWaitingForApproval: true,
                isRunning: false
            })
        })

        it("handles ToolApprovalRequest arriving before ToolCallComplete", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolCall",
                    step_id: "call-1",
                    summary: "delete_file",
                    parameters: '{"path":"/tmp/foo"}',
                    integration: "fs"
                },
                {
                    type: "ToolApprovalRequest",
                    step_id: "call-1",
                    name: "delete_file",
                    arguments: '{"path":"/tmp/foo"}'
                },
                {
                    type: "ToolCallComplete",
                    step_id: "call-1",
                    tool_name: "delete_file",
                    status: ToolCallExecutionStatus.COMPLETED,
                    changed_items: [],
                    integration: "fs",
                    result: "deleted"
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            const fc = turns[0].function_calls[0]
            expect(fc.isWaitingForApproval).toBe(false)
            expect(fc.result).toBe("deleted")
        })

        it("handles ToolApprovalRequest arriving after ToolCallComplete", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolCall",
                    step_id: "call-1",
                    summary: "delete_file",
                    parameters: "{}",
                    integration: "fs"
                },
                {
                    type: "ToolCallComplete",
                    step_id: "call-1",
                    tool_name: "delete_file",
                    status: ToolCallExecutionStatus.COMPLETED,
                    changed_items: [],
                    integration: "fs",
                    result: "deleted"
                },
                {
                    type: "ToolApprovalRequest",
                    step_id: "call-1",
                    name: "delete_file",
                    arguments: "{}"
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            const fc = turns[0].function_calls[0]
            expect(fc.isWaitingForApproval).toBe(true)
            expect(fc.result).toBe("deleted")
        })

        it("handles ToolApprovalResponse by itself (no preceding ToolCall)", () => {
            const events: EventWithTimestamp[] = [{ type: "ToolApprovalResponse", step_id: "resp-1", approved: true }]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].function_calls[0]).toMatchObject({
                id: "resp-1",
                isApproved: true,
                isRejected: false,
                isWaitingForApproval: false
            })
        })

        it("handles ToolApprovalResponse rejected by itself", () => {
            const events: EventWithTimestamp[] = [{ type: "ToolApprovalResponse", step_id: "resp-1", approved: false }]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            expect(turns[0].function_calls[0]).toMatchObject({
                id: "resp-1",
                name: "resp-1",
                isApproved: false,
                isRejected: true
            })
        })

        it("handles full approval flow: ToolCall -> ToolApprovalRequest -> ToolApprovalResponse (approved) -> ToolCallComplete", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolCall",
                    step_id: "call-1",
                    summary: "delete_file",
                    parameters: "{}",
                    integration: "fs"
                },
                {
                    type: "ToolApprovalRequest",
                    step_id: "call-1",
                    name: "delete_file",
                    arguments: "{}"
                },
                { type: "ToolApprovalResponse", step_id: "call-1", approved: true },
                {
                    type: "ToolCallComplete",
                    step_id: "call-1",
                    tool_name: "delete_file",
                    status: ToolCallExecutionStatus.COMPLETED,
                    changed_items: [],
                    integration: "fs",
                    result: "deleted"
                }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            const fc = turns[0].function_calls[0]
            expect(fc.isApproved).toBe(true)
            expect(fc.isRejected).toBe(false)
            expect(fc.isWaitingForApproval).toBe(false)
            expect(fc.result).toBe("deleted")
        })

        it("handles ToolApprovalResponse arriving after ToolCallComplete", () => {
            const events: EventWithTimestamp[] = [
                {
                    type: "ToolCall",
                    step_id: "call-1",
                    summary: "delete_file",
                    parameters: "{}",
                    integration: "fs"
                },
                {
                    type: "ToolApprovalRequest",
                    step_id: "call-1",
                    name: "delete_file",
                    arguments: "{}"
                },
                {
                    type: "ToolCallComplete",
                    step_id: "call-1",
                    tool_name: "delete_file",
                    status: ToolCallExecutionStatus.COMPLETED,
                    changed_items: [],
                    integration: "fs",
                    result: "deleted"
                },
                { type: "ToolApprovalResponse", step_id: "call-1", approved: true }
            ]
            const turns = convertRunHistoryEventsToTurns(events)
            expect(turns).toHaveLength(1)
            const fc = turns[0].function_calls[0]
            expect(fc.isApproved).toBe(true)
            expect(fc.result).toBe("deleted")
        })
    })
})
