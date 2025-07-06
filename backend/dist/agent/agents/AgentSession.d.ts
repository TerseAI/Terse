import { ChangedItem, SendModelRequest } from "../../shared/ModelEvents";
import { EntityType } from "../../shared/Entities";
import { Agent, AgentInputItem, AgentOutputType, StreamedRunResult } from "@openai/agents";
import { Session } from "../../server";
export interface IAgentSession<T extends Session> {
    agent?: Agent<T, AgentOutputType>;
    push(message: SendModelRequest): Promise<void>;
    run(): Promise<StreamedRunResult<T, Agent<T, AgentOutputType>>>;
    setHistory(history: AgentInputItem[]): void;
    getSession(): Session;
    trackChange(type: EntityType, id: string | number): void;
    getAndClearChangedItems(): ChangedItem[];
    getChangedItems(): ChangedItem[];
    getContext(): T;
    getAgent(): Agent<T, AgentOutputType> | undefined;
}
//# sourceMappingURL=AgentSession.d.ts.map