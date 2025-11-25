import { Agent, AgentOutputType, StreamedRunResult } from "@openai/agents";
import { ModelEvent } from "../../shared/ModelEvents";
import { Session } from "../../server";

// Enums for event types
export enum RawModelStreamEventType {
    OutputTextDelta = "output_text_delta",
    Model = "model",
}

// Type for incoming OpenAI events (based on logs)
type RawModelStreamEvent = {
    type: "raw_model_stream_event";
    data: {
        type: RawModelStreamEventType;
        delta?: string;
        providerData?: { item_id?: string; step_id?: string };
        event?: {
            type: "response.output_text.delta";
            delta: string;
            item_id: string;
        };
    };
};

type ToolCallCompleteEvent = {
    type: "run_item_stream_event";
    name: "tool_output";
    item: {
        type: "tool_call_output_item";
        rawItem: {
            type: "function_call_result";
            name: string;
            callId: string;
            status: string;
            output: any;
        };
        agent: any;
        output: any;
    };
};

type ToolCalledEvent = {
    type: "run_item_stream_event";
    name: "tool_called";
    item: {
        type: "tool_call_item";
        rawItem: {
            providerData: any;
            id: string;
            type: "function_call";
            callId: string;
            name: string;
            status: string;
            arguments: string;
        };
        agent: any;
    };
};

type AgentUpdatedEvent = {
    type: "agent_updated_stream_event";
    agent: {
        name: string;
    };
};

type RunItemStreamEvent = {
    type: "run_item_stream_event";
    name: string;
    item: any;
};

/**
 * Converts ChannelAgent stream events to ModelEvent types
 * Similar to toEventStream but adapted for ChannelAgent which doesn't have IAgentSession
 * Works with any agent output type (AgentOutputType or Zod schemas)
 */
export async function* streamChannelAgentEvents<T extends Session>(
    result: StreamedRunResult<T, Agent<T, any>>
): AsyncGenerator<ModelEvent, void, unknown> {
    // The streaming function doesn't actually use the agent type,
    // it just iterates over events, so using 'any' is safe here
    for await (const event of result as AsyncIterable<
        RawModelStreamEvent | ToolCallCompleteEvent | ToolCalledEvent | AgentUpdatedEvent | RunItemStreamEvent
    >) {
        // TextDelta: output_text_delta
        if (
            event.type === "raw_model_stream_event" &&
            event.data?.type === RawModelStreamEventType.OutputTextDelta &&
            typeof event.data.delta === "string"
        ) {
            yield {
                type: "TextDelta",
                delta: event.data.delta,
                step_id: event.data.providerData?.item_id || event.data.providerData?.step_id || "unknown",
            };
        }

        // ToolCalled - this is the actual tool call event
        if (event.type === "run_item_stream_event" && event.name === "tool_called") {
            const toolCalledEvent = event as ToolCalledEvent;
            const item = toolCalledEvent.item.rawItem;

            yield {
                type: "ToolCall",
                summary: item.name,
                step_id: item.callId,
                parameters: item.arguments,
            };
        }

        // ToolCallComplete - this is the actual completion event
        if (event.type === "run_item_stream_event" && event.name === "tool_output") {
            const toolCallCompleteEvent = event as ToolCallCompleteEvent;
            const item = toolCallCompleteEvent.item.rawItem;

            // ChannelAgent doesn't have changedItems tracking like IAgentSession
            // So we'll use an empty array for now
            yield {
                type: "ToolCallComplete",
                tool_name: item.name,
                status: item.status,
                step_id: item.callId,
                changed_items: [],
            };
        }
    }

    // Send NaturalStop when stream completes
    yield {
        type: "NaturalStop",
    };
}

