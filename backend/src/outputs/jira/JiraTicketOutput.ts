import { Tool } from "@openai/agents";
import { ChannelOutput, ChannelJiraConfig, PrismaTransaction, User } from "../../types/prisma";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { JiraConfig } from "../../shared/Configs";
import { IntegrationType, AtlassianIntegration } from "../../shared/Integrations";
import { jiraSearchTicketTool } from "./tools/searchTicket";
import { jiraUpdateTicketTool } from "./tools/updateTicket";
import { jiraCreateTicketTool } from "./tools/createTicket";

export interface JiraTicketSession extends Session {
    jiraIntegration: AtlassianIntegration; // Top level integration record
    jiraConfig: ChannelJiraConfig; // Configuration for the Specific Jira Ticket
}

export class JiraTicketOutput extends Output<JiraTicketSession, JiraConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: jiraSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.ATLASSIAN },
            { tool: jiraCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN },
            { tool: jiraUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN },
        ];
        super(OutputConfigType.JIRA_TICKET, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<JiraTicketSession> {
        const integration = await db().atlassian_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Atlassian integration ${integrationId} not found`);
        }

        const jiraConfigRecord = await db().automation_jira_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!jiraConfigRecord) {
            throw new Error(`Jira config for automation output ${channelOutputConfig.id} not found`);
        }

        return { 
            jiraIntegration: {
                id: integration.id,
                email: integration.jira_user_email,
                baseUrl: integration.base_url,
                siteName: integration.site_name || undefined,
            }, 
            jiraConfig: jiraConfigRecord, 
            user: user, 
            isUserInitiated: true 
        };
    }

    async validateConfig(_output: JiraConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_output_id: channelOutputId,
                project_key: output.projectKey || null,
                project_id: output.projectId || null,
            },
        });
    }
}
