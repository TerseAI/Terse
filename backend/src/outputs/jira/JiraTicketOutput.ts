import { Tool } from "@openai/agents";
import { AgentOutput, AgentJiraConfig, PrismaTransaction, User } from "../../types/prisma";
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
    jiraConfig: AgentJiraConfig; // Configuration for the Specific Jira Ticket
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
        agentOutputConfig: AgentOutput,
        user: User
    ): Promise<JiraTicketSession> {
        const integration = await db().atlassian_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Atlassian integration ${integrationId} not found`);
        }

        const jiraConfigRecord = await db().automation_jira_configs.findFirst({
            where: { automation_output_id: agentOutputConfig.id }
        });

        if (!jiraConfigRecord) {
            throw new Error(`Jira config for automation output ${agentOutputConfig.id} not found`);
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

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_output_id: agentOutputId,
                project_key: output.projectKey || null,
                project_id: output.projectId || null,
            },
        });
    }
}
