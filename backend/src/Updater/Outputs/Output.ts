// MARK: - Output Integratoins

import { Tool } from "@openai/agents";
import { Session } from "../../server";
// You can only have one output at a time. Basically, it's just a specific integration + a toolbox to modify the content.
// For Notion, we should support multiple integrations with the same account. 

export enum OutputType {
    Notion = "notion",
}

export class Output<T extends Session> {
    integration: OutputType;
    toolbox: Tool<T>[];

    constructor(integration: OutputType, toolbox: Tool<T>[]) {
        this.integration = integration;
        this.toolbox = toolbox;
    }
}