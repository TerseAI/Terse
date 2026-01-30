import { SetupSection } from "../pages/Agents/tabs/AgentSetupTab";
import { DonatedState } from "../shared/DonatedState";
import { AgentPrompt, TransientAgentOutput, TransientAgentTrigger, TransientKnowledgeBase } from "../shared/types";

export class AgentSetUpPageContext extends DonatedState {
    readonly stateType = 'Agent Set Up Page Context';
    readonly tab: SetupSection;

    constructor(tab: SetupSection) {
        super();
        this.tab = tab;
    }

    toJSON(): Record<string, unknown> {
        return { 
            stateType: this.stateType,
            description: "The user is currently on a web page designed to create and modify agents.",
            tab: "they are currently focusing on the " + this.tab + " tab",
        };
    }
}

export class AgentNameDonatedState extends DonatedState {
    readonly stateType = 'Agent Name';
    readonly name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    toJSON(): Record<string, unknown> {
        return { name: this.name };
    }
}

export class AgentIdDonatedState extends DonatedState {
    readonly stateType = 'Agent ID';
    readonly id: string | null;

    constructor(id: string | null) {
        super();
        this.id = id;
    }

    toJSON(): Record<string, unknown> {
        return { id: this.id ?? 'This agent is new and not yet saved!' };
    }
}

export class AgentInputsDonatedState extends DonatedState {
    readonly stateType = 'Agent Inputs';
    readonly inputs: TransientAgentTrigger[];

    constructor(inputs: TransientAgentTrigger[]) {
        super();
        this.inputs = inputs;
    }

    toJSON(): Record<string, unknown> {
        return { 
            inputs: this.inputs.map(input => 
                input.config?.formatForAgent() || `Type: ${input.configType}`
            )
        };
    }
}

export class AgentOutputsDonatedState extends DonatedState {
    readonly stateType = 'Agent Outputs';
    readonly outputs: TransientAgentOutput[];

    constructor(outputs: TransientAgentOutput[]) {
        super();
        this.outputs = outputs;
    }

    toJSON(): Record<string, unknown> {
        return { 
            outputs: this.outputs.map(output => 
                output.config?.formatForAgent() || `Type: ${output.configType}`
            )
        };
    }
}

export class AgentKnowledgeBasesDonatedState extends DonatedState {
    readonly stateType = 'Agent Knowledge Bases';
    readonly knowledgeBases: TransientKnowledgeBase[];

    constructor(knowledgeBases: TransientKnowledgeBase[]) { super();
        this.knowledgeBases = knowledgeBases;
    }

    toJSON(): Record<string, unknown> {
        return { 
            knowledgeBases: this.knowledgeBases.map(knowledgeBase => 
                knowledgeBase.config?.formatForAgent() || `Type: ${knowledgeBase.configType}`
            )
        };
    }
}

export class AgentPromptDonatedState extends DonatedState {
    readonly stateType = 'Agent Prompt';
    readonly prompt: AgentPrompt;

    constructor(prompt: AgentPrompt) {
        super();
        this.prompt = prompt;
    }

    toJSON(): Record<string, unknown> {
        return { prompt: this.prompt.text };
    }
}