import { Tool } from "@openai/agents";
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { OutputConfigType } from "@prisma/client";
import { GmailOutputConfig } from "../../shared/Configs";
import { gmailSendEmailTool } from "./tools/sendEmail";
import { IntegrationType } from "../../shared/Integrations";

export class GmailOutput extends Output<GmailOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: gmailSendEmailTool as Tool, isReadOnly: false, integration: IntegrationType.GMAIL },
        ];
        super(OutputConfigType.GMAIL, toolbox);
    }

    async validateConfig(output: GmailOutputConfig, _userId: string): Promise<void> {
        if (!output.integrationId) {
            throw new Error('Invalid output config for gmail_output: missing integrationId');
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, _output: GmailOutputConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_output_id: channelOutputId,
            },
        });
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Gmail configs provided');
        }
        
        const sections: string[] = [];
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.gmail_config) {
                throw new Error('Gmail config not found');
            }
            configList.push(`  • Integration ID: ${config.integration_id}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Gmail tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');
        sections.push('\n' + GMAIL_OUTPUT_INSTRUCTIONS);
        
        return sections.join('\n');
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
