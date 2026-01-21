import { Tool } from "@openai/agents";
import { AgentOutput, PrismaTransaction, User, GmailIntegration } from "../../types/prisma";
import { automation_gmail_configs } from "@prisma/client";
import { Session } from "../../server";
import { Output, ToolboxEntry } from "../abstract/Output";
import { db } from "../../prismaClient";
import { OutputConfigType } from "@prisma/client";
import { GmailOutputConfig } from "../../shared/Configs";
import { gmailSendEmailTool } from "./tools/sendEmail";
import { IntegrationType } from "../../shared/Integrations";

export interface GmailSession extends Session {
    gmailIntegration: GmailIntegration; // User's Gmail integration record
    gmailConfig: automation_gmail_configs; // Configuration for the Gmail output
}

export class GmailOutput extends Output<GmailSession, GmailOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: gmailSendEmailTool as Tool, isReadOnly: false, integration: IntegrationType.GMAIL },
        ];
        super(OutputConfigType.GMAIL, toolbox);
    }

    async createSessionFromConfig(
        integrationId: string,
        agentOutputConfig: AgentOutput,
        user: User
    ): Promise<GmailSession> {
        // For Gmail, integrationId is the gmail_integrations.id
        const gmailIntegration = await db().gmail_integrations.findFirst({
            where: { 
                id: integrationId,
                user_id: user.id,
                is_active: true,
            },
        });

        if (!gmailIntegration) {
            throw new Error(`Gmail integration ${integrationId} not found for user or is inactive`);
        }

        const gmailConfigRecord = await db().automation_gmail_configs.findFirst({
            where: { automation_output_id: agentOutputConfig.id }
        });

        if (!gmailConfigRecord) {
            throw new Error(`Gmail config for automation output ${agentOutputConfig.id} not found`);
        }

        return { 
            gmailIntegration: gmailIntegration, 
            gmailConfig: gmailConfigRecord, 
            user: user, 
            isUserInitiated: true 
        };
    }

    async validateConfig(output: GmailOutputConfig, _userId: string): Promise<void> {
        if (!output.integrationId) {
            throw new Error('Invalid output config for gmail_output: missing integrationId');
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, _output: GmailOutputConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_output_id: agentOutputId,
            },
        });
    }

    getSystemInstructions(_session: GmailSession): string {
        return GMAIL_OUTPUT_INSTRUCTIONS;
    }
}

const GMAIL_OUTPUT_INSTRUCTIONS = `
=== GMAIL OUTPUT ===

TOOL:
- gmail_send_email: Send emails or reply to existing email threads via Gmail.

EMAIL TYPES:
- New email: Send a new email by providing \`to\`, \`subject\`, and \`body\`. Leave \`thread_id\` empty.
- Reply: Reply to an existing email by providing \`thread_id\` (the Gmail Thread ID from the email event, NOT the Message-ID) along with \`to\`, \`subject\`, and \`body\`.

IMPORTANT: The \`thread_id\` parameter must be the Gmail Thread ID (a numeric string like "1234567890"), NOT the Message-ID header (which looks like "<...@mail.gmail.com>").

WHEN TO USE:
- New email → Sending a standalone email to one or more recipients
- Reply → Responding to an existing email thread (maintains conversation context)

BEST PRACTICES:
- Always provide clear, concise subject lines
- For replies, use the Thread ID from the incoming email event (not the Message-ID)
- Use plain text in the body (HTML is not currently supported)
- Include relevant context in replies by referencing the original email
`.trim();
