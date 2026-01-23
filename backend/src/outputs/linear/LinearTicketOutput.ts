
import { Tool } from "@openai/agents";
import { AgentOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { LinearOutputConfig } from "../../shared/Configs";
import { linearSearchTicketTool } from "./tools/searchTicket";
import { linearUpdateTicketTool } from "./tools/updateTicket";
import { linearCreateTicketTool } from "./tools/createTicket";
import { IntegrationType } from "../../shared/Integrations";

export class LinearTicketOutput extends Output<LinearOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: linearSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: 'Search tickets' },
            { tool: linearCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: 'Create ticket' },
            { tool: linearUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: 'Update ticket' },
        ];
        super(OutputConfigType.LINEAR_TICKET, toolbox);
    }


    async validateConfig(output: LinearOutputConfig, _userId: string): Promise<void> {
        if (!output.teamId) {
            throw new Error('Invalid output config for linear_output: missing teamId');
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: LinearOutputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_output_id: channelOutputId,
                team_id: output.teamId || null,
                team_name: output.teamName || null
            },
        });
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Linear configs provided');
        }
        
        const sections: string[] = [];
        sections.push('=== LINEAR TICKET OUTPUT ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.linear_config) {
                throw new Error('Linear config not found');
            }
            const teamId = config.linear_config.team_id;
            const teamName = config.linear_config.team_name;
            configList.push(`  • Integration ID: ${config.integration_id} - Team Name: ${teamName || 'N/A'}, Team ID: ${teamId || 'N/A'}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Linear tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');
        
        return sections.join('\n');
    }
}
