// MARK: - Output Integratoins

import { Tool } from "@openai/agents";
import { Session } from "../../server";
import { AutomationOutput, User } from "../../types/prisma";
// You can only have one output at a time. Basically, it's just a specific integration + a toolbox to modify the content.
// For Notion, we should support multiple integrations with the same account. 

export enum OutputType {
    Notion = "notion",
}

export abstract class Output<T extends Session> {
    integration: OutputType;
    toolbox: Tool<T>[];

    constructor(integration: OutputType, toolbox: Tool<T>[]) {
        this.integration = integration;
        this.toolbox = toolbox;
    }

    /**
     * Create a session from integration ID and automation output config.
     * Each output subclass fetches its own integration and implements its own config extraction logic.
     * @param integrationId The ID of the integration to fetch from the database
     * @param automationOutputConfig The automation output with config relations loaded (e.g., notion_config, slack_config)
     * @param user The user for the session
     * @returns A session instance with merged config data (config overrides integration defaults)
     */
    abstract createSessionFromConfig(
        integrationId: string, // Integration ID to fetch from database
        automationOutputConfig: AutomationOutput, // AutomationOutput with loaded config relations
        user: User
    ): Promise<T>;
}