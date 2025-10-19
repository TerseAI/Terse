// MARK: - Output Integratoins

import { ToolBox } from "src/agent/agents/Agent";

// You can only have one output at a time. Basically, it's just a specific integration + a toolbox to modify the content.
// For Notion, we should support multiple integrations with the same account. 

export enum OutputType {
    Notion = "notion",
}

export class Output {
    integration: OutputType;
    toolbox: ToolBox;

    constructor(integration: OutputType, toolbox: ToolBox) {
        this.integration = integration;
        this.toolbox = toolbox;
    }
}