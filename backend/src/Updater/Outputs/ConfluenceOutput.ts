import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { ConfluenceIntegration } from "../../shared/types";
import { AutomationOutput, User, AutomationConfluenceConfig } from "../../types/prisma";
import { Session } from "../../server";
import { Output, OutputType } from "./Output";
import { db } from "../../prismaClient";
import { Tool } from "@openai/agents";

export interface ConfluenceSession extends Session {
    confluenceIntegration: ConfluenceIntegration; // Top level integration record
    confluenceConfig: AutomationConfluenceConfig; // Configuration for the Specific Confluence Database
    // Collect actions here (report-only); DB writes happen after agent finishes
    runActions?: RunHistoryAction[];
}

export class ConfluenceOutput extends Output<ConfluenceSession> {
    constructor() {
        const toolbox: Tool<ConfluenceSession>[] = [];
        super(OutputType.Confluence, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        automationOutputConfig: AutomationOutput,
        user: User
    ): Promise<ConfluenceSession> {
        const integration = await db().jira_api_keys.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Confluence integration ${integrationId} not found`);
        }

        const confluenceConfig: AutomationConfluenceConfig | null = await db().automation_confluence_configs.findFirst({
            where: { automation_output_id: automationOutputConfig.id }
        });

        if (!confluenceConfig) {
            throw new Error(`Confluence config for automation output ${automationOutputConfig.id} not found`);
        }

        const confluenceIntegration: ConfluenceIntegration = {
            id: integration.id,
            confluence_user_email: integration.jira_user_email,
            api_key: integration.api_token,
            base_url: integration.base_url,
        };

        return { confluenceIntegration: confluenceIntegration, confluenceConfig: confluenceConfig, user: user, isUserInitiated: true, runActions: [] };
    }
}