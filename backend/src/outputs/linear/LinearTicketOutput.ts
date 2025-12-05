
import { Tool } from "@openai/agents";
import { ChannelOutput, ChannelLinearConfig, LinearIntegration, PrismaTransaction, User } from "../../types/prisma";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { LinearOutputConfig } from "../../shared/Configs";
import { linearSearchTicketTool } from "./tools/searchTicket";
import { linearUpdateTicketTool } from "./tools/updateTicket";
import { linearCreateTicketTool } from "./tools/createTicket";
import { IntegrationType } from "../../shared/Integrations";

export interface LinearTicketSession extends Session {
    linearIntegration: LinearIntegration; // Top level integration record
    linearConfig: ChannelLinearConfig; // Configuration for the Specific Linear Ticket
}

export class LinearTicketOutput extends Output<LinearTicketSession, LinearOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: linearSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR },
            { tool: linearCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR },
            { tool: linearUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR },
        ];
        super(OutputConfigType.LINEAR_TICKET, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        channelOutputConfig: ChannelOutput,
        user: User
    ): Promise<LinearTicketSession> {
        const integration = await db().linear_integrations.findFirst({
            where: { id: integrationId }
        });

        if (!integration) {
            throw new Error(`Linear integration ${integrationId} not found`);
        }

        const linearConfigRecord = await db().automation_linear_configs.findFirst({
            where: { automation_output_id: channelOutputConfig.id }
        });

        if (!linearConfigRecord) {
            throw new Error(`Linear config for automation output ${channelOutputConfig.id} not found`);
        }

        return { linearIntegration: integration, linearConfig: linearConfigRecord, user: user, isUserInitiated: true };
    }

    async addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: LinearOutputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_output_id: channelOutputId,
                team_id: output.teamId || null,
                team_name: output.teamName || null
            },
        });
    }
}
