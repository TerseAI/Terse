import { Agent, AgentInputItem, StreamedRunResult, AgentOutputType, Tool } from '@openai/agents';
import { Session } from '../../server';
import { SendModelRequest, ChangedItem } from "../../shared/ModelEvents";
import { IAgentSession } from './AgentSession';
import { EntityType } from '../../shared/Entities';
export type SessionWithTracking = Session & {
    trackChange: (type: EntityType, id: string | number) => void;
};
export declare class AgentSession implements IAgentSession<SessionWithTracking> {
    private history;
    private session;
    private toolBox;
    private changedItems;
    agent?: Agent<SessionWithTracking, AgentOutputType>;
    constructor(session: Session);
    push(message: SendModelRequest): Promise<void>;
    run(): Promise<StreamedRunResult<SessionWithTracking, Agent<SessionWithTracking, AgentOutputType>>>;
    setHistory(history: AgentInputItem[]): void;
    getSession(): Session;
    trackChange(type: EntityType, id: string | number): void;
    getAndClearChangedItems(): ChangedItem[];
    getChangedItems(): ChangedItem[];
    getContext(): SessionWithTracking;
    getAgent(): Agent<SessionWithTracking, AgentOutputType> | undefined;
}
export declare class ToolBox {
    private tools;
    constructor();
    getTools(toolBoxType: ToolBoxType): Tool<SessionWithTracking>[];
}
declare enum ToolBoxType {
    standard = "standard",
    onboarding = "onboarding"
}
export {};
//# sourceMappingURL=Agent.d.ts.map