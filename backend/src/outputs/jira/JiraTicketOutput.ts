import { Tool } from "@openai/agents";
import { ChannelOutputWithConfigs, PrismaTransaction } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { OutputConfigType } from "@prisma/client";
import { JiraConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { jiraSearchTicketTool } from "./tools/searchTicket";
import { jiraUpdateTicketTool } from "./tools/updateTicket";
import { jiraCreateTicketTool } from "./tools/createTicket";

export class JiraTicketOutput extends Output<JiraConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: jiraSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.ATLASSIAN, displayName: 'Searching tickets' },
            { tool: jiraCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN, displayName: 'Creating a ticket' },
            { tool: jiraUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN, displayName: 'Updating a ticket' },
        ];
        super(OutputConfigType.JIRA_TICKET, toolbox);
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

    protected getSystemInstructionsForConfigs(configs: ChannelOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Jira configs provided');
        }
        
        const sections: string[] = [];
        sections.push('=== JIRA TICKET OUTPUT ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.jira_config) {
                throw new Error('Jira config not found');
            }
            const projectKey = config.jira_config.project_key;
            const projectId = config.jira_config.project_id;
            configList.push(`  • Integration ID: ${config.integration_id} - Project Key: ${projectKey || 'N/A'}, Project ID: ${projectId || 'N/A'}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Jira tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');
        
        return sections.join('\n');
    }
}
