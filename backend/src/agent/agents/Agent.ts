import { Agent, AgentInputItem, run, StreamedRunResult, user, AgentOutputType, RunRawModelStreamEvent, Tool } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from '../systemPrompt';
import { SendModelRequest, ChangedItem, ChangeEventType } from "../../shared/ModelEvents";
import { IAgentSession } from './AgentSession';
import { EntityType } from '../../shared/Entities';
import { ticketTools } from '../tools/ticketingTools';
import { jiraTicketTools } from '../tools/jiraTicketingTools';
import { TicketSystemType } from '../../shared/TicketSystem';
// Enhanced session type with change tracking
export type SessionWithTracking = Session & { 
  trackChange: (type: EntityType, id: string | number, eventType: ChangeEventType) => void 
};


export class AgentSession implements IAgentSession<SessionWithTracking> {
  private history: AgentInputItem[] = [];
  private session: Session;
  private toolBox: ToolBox<SessionWithTracking>;
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
    const ticketSystemType = this.session.ticketManager?.type || TicketSystemType.Linear;
    const toolBoxType = ticketSystemType === TicketSystemType.Jira ? ToolBoxType.jira : ToolBoxType.linear;
    console.log('🔧 Tool box type', toolBoxType);
    
    // Extract the current user input from the history (last user message)
    let currentInput: string | undefined;
    if (this.history.length > 0) {
      const lastItem = this.history[this.history.length - 1];
      const lastItemAny = lastItem as any;
      if (lastItemAny.role === 'user') {
        if (typeof lastItemAny.content === 'string') {
          currentInput = lastItemAny.content;
        } else if (Array.isArray(lastItemAny.content)) {
          // Handle array content (multimodal)
          currentInput = lastItemAny.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text || '')
            .join(' ');
        }
      }
    }
    
    const agent = new Agent<SessionWithTracking, AgentOutputType>({
      name: 'LLM ticket manager',
      instructions: await systemPrompt(this.session, currentInput),
      model: 'gpt-4o',
      tools: this.toolBox.getTools(toolBoxType) as Tool<SessionWithTracking>[]
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

export class ToolBox<T extends Session> {
  private tools: Tool<T>[] = [];

  constructor() {
  }

  getTools(toolBoxType: ToolBoxType): Tool<SessionWithTracking>[] {
    if (toolBoxType === ToolBoxType.jira) {
      return jiraTicketTools as Tool<SessionWithTracking>[];
    } else if (toolBoxType === ToolBoxType.linear) {
      return ticketTools as Tool<SessionWithTracking>[];
    } else {
      return ticketTools as Tool<SessionWithTracking>[];
    }
  }
}

enum ToolBoxType {
  standard = 'standard',
  onboarding = 'onboarding',
  jira = 'jira',
  linear = 'linear'
}