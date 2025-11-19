// MARK: - Output Integratoins

import { Tool } from "@openai/agents";
import { Session } from "../../server";
import { AutomationOutput, PrismaTransaction, User } from "../../types/prisma";
import { OutputConfigType } from "@prisma/client";
import { ConfigInstance } from "src/shared/Configs";
// You can only have one output at a time. Basically, it's just a specific integration + a toolbox to modify the content.
// For Notion, we should support multiple integrations with the same account. 

export interface ToolboxEntry {
    tool: Tool;
    isReadOnly: boolean;
}

export abstract class Output<T extends Session, TConfig extends ConfigInstance> {
    integration: OutputConfigType;
    readonly toolbox: readonly ToolboxEntry[];

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
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

    abstract addOutputToAutomation(tx: PrismaTransaction, automationOutputId: string, output: TConfig): Promise<void>;
}