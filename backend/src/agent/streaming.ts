import { Agent, AgentOutputType, StreamedRunResult } from "@openai/agents";
import { ModelEvent } from "../shared/ModelEvents";
import { Session } from "../server";
import { IAgentSession } from "./agents/AgentSession";

// Enums for event types
export enum RawModelStreamEventType {
    OutputTextDelta = "output_text_delta",
    Model = "model",
  }
  
  // Type for incoming OpenAI events (based on logs)
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

  export type ToolCallCompleteEvent = {
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

  export type ToolCalledEvent = {
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
  
  /**
   * Converts stream events to ModelEvent types
   * Works with any agent output type (AgentOutputType or Zod schemas)
   * @param result - The streamed run result from the agent
   * @param agentSession - Optional agent session for tracking changed items. If not provided, changed_items will be empty.
   */
  export async function* toEventStream<T extends Session = Session>(
    result: StreamedRunResult<T, Agent<T, any>>,
    agentSession?: IAgentSession<any>
  ): AsyncGenerator<ModelEvent, void, unknown> {
    for await (const event of result as AsyncIterable<RawModelStreamEvent | ToolCallCompleteEvent | ToolCalledEvent>) {          
      // TextDelta: output_text_delta
      if (
        event.type === "raw_model_stream_event" &&
        event.data?.type === RawModelStreamEventType.OutputTextDelta &&
        typeof event.data.delta === "string"
      ) {
        yield {
          type: "TextDelta",
          delta: event.data.delta,
          step_id: event.data.providerData?.item_id || event.data.providerData?.step_id || "unknown"
        };
      }

      // ToolCalled - this is the actual tool call event
      if (
        event.type === "run_item_stream_event" &&
        event.name === "tool_called"
      ) {
        const toolCalledEvent = event as ToolCalledEvent;
        const item = toolCalledEvent.item.rawItem;
        
        console.log('ToolCalled', item.name, item.callId);
        
        // Send ToolCall event with the actual parameters
        yield {
          type: "ToolCall",
          summary: item.name,
          step_id: item.callId,
          parameters: item.arguments
        };
      }

      // ToolCallComplete - this is the actual completion event
      if (
        event.type === "run_item_stream_event" &&
        event.name === "tool_output"
      ) {
        const toolCallCompleteEvent = event as ToolCallCompleteEvent;
        const item = toolCallCompleteEvent.item.rawItem;            
        // Get the changed items for this tool call, or use empty array if no session provided
        const changedItems = agentSession?.getAndClearChangedItems() || [];
        
        yield {
          type: "ToolCallComplete",
          tool_name: item.name,
          status: item.status,
          step_id: item.callId,
          changed_items: changedItems
        };
      }
    }
    
    // Send NaturalStop when stream completes
    yield {
      type: "NaturalStop",
    };
  }