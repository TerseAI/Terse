// Enums for event types
export var RawModelStreamEventType;
(function (RawModelStreamEventType) {
    RawModelStreamEventType["OutputTextDelta"] = "output_text_delta";
    RawModelStreamEventType["Model"] = "model";
})(RawModelStreamEventType || (RawModelStreamEventType = {}));
export async function toEventStream(result, agentSession) {
    return new ReadableStream({
        async start(controller) {
            // Unfortunate hack to get tool call arguments.
            const toolCallArgs = {};
            for await (const event of result) {
                // TextDelta: output_text_delta
                if (event.type === "raw_model_stream_event" &&
                    event.data?.type === RawModelStreamEventType.OutputTextDelta &&
                    typeof event.data.delta === "string") {
                    controller.enqueue({
                        type: "TextDelta",
                        delta: event.data.delta,
                        step_id: event.data.providerData?.item_id || event.data.providerData?.step_id || "unknown"
                    });
                }
                // ToolCalled - this is the actual tool call event
                if (event.type === "run_item_stream_event" &&
                    event.name === "tool_called") {
                    const toolCalledEvent = event;
                    const item = toolCalledEvent.item.rawItem;
                    console.log('ToolCalled', item);
                    // Send ToolCall event with the actual parameters
                    controller.enqueue({
                        type: "ToolCall",
                        summary: item.name,
                        step_id: item.callId,
                        parameters: item.arguments
                    });
                }
                // ToolCallComplete - this is the actual completion event
                if (event.type === "run_item_stream_event" &&
                    event.name === "tool_output") {
                    const toolCallCompleteEvent = event;
                    const item = toolCallCompleteEvent.item.rawItem;
                    // Get the changed items for this tool call
                    const changedItems = agentSession.getAndClearChangedItems();
                    controller.enqueue({
                        type: "ToolCallComplete",
                        tool_name: item.name,
                        status: item.status,
                        step_id: item.callId,
                        changed_items: changedItems
                    });
                }
            }
            controller.close();
        },
        cancel() {
            console.log("cancel");
        },
    });
}
//# sourceMappingURL=streaming.js.map