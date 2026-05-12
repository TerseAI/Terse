import { OutputConfigType } from "@prisma/client"
import { GmailOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { defineToolEntry } from "../abstract/Output"

import { gmailSendEmailTool, validateGmailSendEmail } from "./tools/sendEmail"

export class GmailOutput extends Output<GmailOutputConfig> {
    constructor() {
        const t = defineToolEntry<GmailOutputConfig>()
        const toolbox = [t({ tool: gmailSendEmailTool, isReadOnly: false, integration: IntegrationType.GMAIL, displayName: "Send email", validateACL: validateGmailSendEmail })]
        super(OutputConfigType.GMAIL, toolbox)
    }

    protected getDummyConfigForCapability(): GmailOutputConfig {
        return new GmailOutputConfig("example")
    }

    async validateConfig(output: GmailOutputConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, _output: GmailOutputConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_output_id: channelOutputId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: GmailOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Gmail configs provided")
        }

        const sections: string[] = []

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            configList.push(`  • Integration ID: ${config.integrationId}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Gmail tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("\n" + GMAIL_OUTPUT_INSTRUCTIONS)

        return sections.join("\n")
    }
}

const GMAIL_OUTPUT_INSTRUCTIONS = `
=== GMAIL OUTPUT ===

TOOL:
- gmail_send_email: Send emails or reply to existing email threads via Gmail.

EMAIL TYPES:
- New email: Send a new email by providing \`to\`, \`subject\`, and at least one of \`body\` or \`html_body\`. Leave \`thread_id\` empty.
- Reply: Reply to an existing email by providing \`thread_id\` (the Gmail Thread ID from the email event, NOT the Message-ID) along with \`to\`, \`subject\`, and at least one of \`body\` or \`html_body\`.

BODY FORMATS:
- Plain text: Provide \`body\`.
- HTML: Provide \`html_body\`.
- Best compatibility: Provide both \`body\` and \`html_body\` to send multipart/alternative.

IMPORTANT: The \`thread_id\` parameter must be the Gmail Thread ID (a numeric string like "1234567890"), NOT the Message-ID header (which looks like "<...@mail.gmail.com>").

WHEN TO USE:
- New email → Sending a standalone email to one or more recipients
- Reply → Responding to an existing email thread (maintains conversation context)

BEST PRACTICES:
- Always provide clear, concise subject lines
- For replies, use the Thread ID from the incoming email event (not the Message-ID)
- Prefer sending both \`body\` and \`html_body\` for client compatibility
- Include relevant context in replies by referencing the original email

USER-FACING RESPONSE STYLE:
- After sending, confirm the outcome succinctly in user-facing language.
- Do NOT mention low-level implementation details unless explicitly asked (for example: CID/content-id, MIME/base64 internals, replacement image URLs, attachment plumbing).
- If the user explicitly asks for technical/debug details, you may provide those details.
`.trim()
