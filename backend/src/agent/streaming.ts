import { Agent, StreamedRunResult } from "@openai/agents";
import { ModelEvent, ChangedItem } from "../shared/ModelEvents";
import { Session } from "../server";
import { randomString } from "../utility/strings";
import { IntegrationType } from "../shared/Integrations";


export async function* transformAgentStreamToModelEvents<T extends Session>(
    result: StreamedRunResult<T, Agent<T, any>>,
    options: {
        toolToIntegrationMap?: Map<string, string>;
        onToolCallComplete?: ToolCallCompleteHandler;
    } = {}
): AsyncGenerator<ModelEvent, void, unknown> {
    const { toolToIntegrationMap, onToolCallComplete } = options;

    for await (const event of result as AsyncIterable<AgentStreamEvent>) {
        // Try TextDelta
        const textDelta = tryExtractTextDelta(event);
        if (textDelta) {
            yield textDelta;
            continue;
        }

        // Try ToolCall
        const toolCall = tryExtractToolCall(event, toolToIntegrationMap);
        if (toolCall) {
            yield toolCall;
            continue;
        }

        // Try ToolCallComplete
        const toolCompleteData = tryExtractToolCallCompleteData(event);
        if (toolCompleteData) {
            const changedItems = onToolCallComplete 
                ? await onToolCallComplete(toolCompleteData.callId)
                : [];
            
            yield createToolCallCompleteEvent(toolCompleteData, changedItems, toolToIntegrationMap);
            continue;
        }
    }

    yield createNaturalStopEvent();
}

export function tryExtractTextDelta(event: AgentStreamEvent): ModelEvent | null {
    if (
        event.type === "raw_model_stream_event" &&
        event.data?.type === RawModelStreamEventType.OutputTextDelta &&
        typeof event.data.delta === "string"
    ) {
        return {
            type: "TextDelta",
            delta: event.data.delta,
            step_id: event.data.providerData?.item_id || event.data.providerData?.step_id || "unknown",
        };
    }
    return null;
}

export function tryExtractToolCall(
    event: AgentStreamEvent,
    toolToIntegrationMap?: Map<string, string>
): ModelEvent | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_called") {
        const item = (event as ToolCalledEvent).item.rawItem;
        
        // Handle hosted tool calls
        if (item.type === "hosted_tool_call") {
            const integration = IntegrationType.TERSE
            const parameters = item.providerData?.action 
                ? JSON.stringify(item.providerData.action)
                : JSON.stringify(item.providerData || {});
            
            return {
                type: "ToolCall",
                summary: item.name,
                step_id: item.id || item.callId || "unknown",
                parameters,
                integration
            };
        }
        
        // Handle regular function calls
        if (item.type === "function_call") {
            const integration = toolToIntegrationMap?.get(item.name) || "unknown";
            
            return {
                type: "ToolCall",
                summary: item.name,
                step_id: item.callId || "unknown",
                parameters: item.arguments || "{}",
                integration
            };
        }
    }
    return null;
}

export function tryExtractToolCallCompleteData(event: AgentStreamEvent): ToolCallCompleteData | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_output") {
        const item = (event as ToolCallCompleteEvent).item.rawItem;
        
        // Handle hosted tool calls
        if (item.type === "hosted_tool_call" || (item as any).type === "hosted_tool_call_result") {
            return {
                name: item.name,
                callId: (item as any).id || item.callId || "unknown",
                status: item.status || "unknown",
            };
        }
        
        // Handle regular function call results
        if (item.type === "function_call_result") {
            return {
                name: item.name,
                callId: item.callId || "unknown",
                status: item.status || "unknown",
            };
        }
    }
    return null;
}

export function createToolCallCompleteEvent(
    data: ToolCallCompleteData,
    changedItems: ChangedItem[],
    toolToIntegrationMap?: Map<string, string>
): ModelEvent {
    const integration = toolToIntegrationMap?.get(data.name) || "terse";
    
    return {
        type: "ToolCallComplete",
        tool_name: data.name,
        status: data.status,
        step_id: data.callId,
        changed_items: changedItems,
        integration,
    };
}

export function createNaturalStopEvent(): ModelEvent {
    // generate a random step_id
    return { type: "NaturalStop", step_id: randomString(15) };
}

export enum RawModelStreamEventType {
    OutputTextDelta = "output_text_delta",
    Model = "model",
}

export type RawModelStreamEvent = {
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

export type ToolCalledEvent = {
    type: "run_item_stream_event";
    name: "tool_called";
    item: {
        type: "tool_call_item";
        rawItem: {
            providerData?: any;
            id?: string;
            type: "function_call" | "hosted_tool_call";
            callId?: string;
            name: string;
            status?: string;
            arguments?: string;
        };
        agent: any;
    };
};

export type ToolCallCompleteEvent = {
    type: "run_item_stream_event";
    name: "tool_output";
    item: {
        type: "tool_call_output_item";
        rawItem: {
            type: "function_call_result" | "hosted_tool_call" | "hosted_tool_call_result";
            name: string;
            callId?: string;
            id?: string;
            status: string;
            output?: any;
        };
        agent: any;
        output?: any;
    };
};

export type AgentStreamEvent = RawModelStreamEvent | ToolCalledEvent | ToolCallCompleteEvent;

export type ToolCallCompleteHandler = (callId: string) => Promise<ChangedItem[]>;

export type ToolCallCompleteData = {
    name: string;
    callId: string;
    status: string;
};
