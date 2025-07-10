import { Agent, AgentInputItem, run, StreamedRunResult, user, AgentOutputType, RunRawModelStreamEvent, Tool } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from '../systemPrompt';
import { SendModelRequest, ChangedItem, ChangeEventType } from "../../shared/ModelEvents";
import { IAgentSession } from './AgentSession';
import { EntityType } from '../../shared/Entities';
import { ticketTools } from '../tools/ticketingTools';
// Enhanced session type with change tracking
export type SessionWithTracking = Session & { 
  trackChange: (type: EntityType, id: string | number, eventType: ChangeEventType) => void 
};


export class AgentSession implements IAgentSession<SessionWithTracking> {
  private history: AgentInputItem[] = [];
  private session: Session;
  private toolBox: ToolBox;
  private changedItems: ChangedItem[] = [];
  agent?: Agent<SessionWithTracking, AgentOutputType>;

  constructor(session: Session) {
    this.history = [];
    this.session = session;
    this.toolBox = new ToolBox();
    this.changedItems = [];
  }

  async push(message: SendModelRequest) {
    this.history.push(user(message.user_message));
  }

  async run(): Promise<StreamedRunResult<SessionWithTracking, Agent<SessionWithTracking, AgentOutputType>>> {
    const agent = new Agent<SessionWithTracking, AgentOutputType>({
      name: 'LLM ticket manager',
      instructions: await systemPrompt(this.session),
      model: 'gpt-4o',
      tools: this.toolBox.getTools(ToolBoxType.standard)
    });

    this.agent = agent;

    const result = await run(agent, this.history, {
      stream: true,
      context: this.getContext(),
    });

    return result;
  }

  setHistory(history: AgentInputItem[]) {
    this.history = history;
  }

  getSession() {
    return this.session;
  }

  // Track changes made by tools
  trackChange(type: EntityType, id: string | number, eventType: ChangeEventType) {
    this.changedItems.push({
      type_name: type,
      id: id.toString(),
      change_event_type: eventType
    });
  }

  // Get and clear the changed items
  getAndClearChangedItems(): ChangedItem[] {
    const items = [...this.changedItems];
    this.changedItems = [];
    return items;
  }

  // Get current changed items without clearing
  getChangedItems(): ChangedItem[] {
    return [...this.changedItems];
  }

  // Helper to get session context for tools
  getContext(): SessionWithTracking {
    return {
      ...this.session,
      trackChange: (type: EntityType, id: string | number, eventType: ChangeEventType) => this.trackChange(type, id, eventType)
    };
  }

  getAgent(): Agent<SessionWithTracking, AgentOutputType> | undefined {
    return this.agent;  
  }
}

export class ToolBox {
  private tools: Tool<SessionWithTracking>[] = [];

  constructor() {
    this.tools = ticketTools;
  }

  getTools(toolBoxType: ToolBoxType) {
    return this.tools;
  }
}

enum ToolBoxType {
  standard = 'standard',
  onboarding = 'onboarding',
}