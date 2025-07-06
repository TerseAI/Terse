import { Agent, run, user } from '@openai/agents';
import { systemPrompt } from '../systemPrompt.js';
import { ticketTools } from '../tools/ticketingTools.js';
export class AgentSession {
    history = [];
    session;
    toolBox;
    changedItems = [];
    agent;
    constructor(session) {
        this.history = [];
        this.session = session;
        this.toolBox = new ToolBox();
        this.changedItems = [];
    }
    async push(message) {
        this.history.push(user(message.user_message));
    }
    async run() {
        const agent = new Agent({
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
    setHistory(history) {
        this.history = history;
    }
    getSession() {
        return this.session;
    }
    // Track changes made by tools
    trackChange(type, id) {
        this.changedItems.push({
            type_name: type,
            id: id.toString()
        });
    }
    // Get and clear the changed items
    getAndClearChangedItems() {
        const items = [...this.changedItems];
        this.changedItems = [];
        return items;
    }
    // Get current changed items without clearing
    getChangedItems() {
        return [...this.changedItems];
    }
    // Helper to get session context for tools
    getContext() {
        return {
            ...this.session,
            trackChange: (type, id) => this.trackChange(type, id)
        };
    }
    getAgent() {
        return this.agent;
    }
}
export class ToolBox {
    tools = [];
    constructor() {
        this.tools = ticketTools;
    }
    getTools(toolBoxType) {
        return this.tools;
    }
}
var ToolBoxType;
(function (ToolBoxType) {
    ToolBoxType["standard"] = "standard";
    ToolBoxType["onboarding"] = "onboarding";
})(ToolBoxType || (ToolBoxType = {}));
//# sourceMappingURL=Agent.js.map