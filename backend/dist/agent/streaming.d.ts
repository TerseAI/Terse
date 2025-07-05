import { Agent, AgentOutputType, StreamedRunResult } from "@openai/agents";
import { ModelEvent } from "../shared/ModelEvents";
import { SessionWithTracking } from "./agents/Agent";
import { IAgentSession } from "./agents/AgentSession";
export declare enum RawModelStreamEventType {
    OutputTextDelta = "output_text_delta",
    Model = "model"
}
export declare function toEventStream(result: StreamedRunResult<SessionWithTracking, Agent<SessionWithTracking, AgentOutputType>>, agentSession: IAgentSession<any>): Promise<ReadableStream<ModelEvent>>;
//# sourceMappingURL=streaming.d.ts.map