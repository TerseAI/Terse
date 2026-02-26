import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { GmailDraftOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { GmailDraftOutputConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { gmailCreateDraftTool } from "./tools/createDraft"

export class GmailDraftOutput extends Output<GmailDraftOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [{ tool: gmailCreateDraftTool as Tool, isReadOnly: false, integration: IntegrationType.GMAIL, displayName: "Create draft" }]
        super(OutputConfigType.GMAIL_DRAFT, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.GMAIL_DRAFT)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "Gmail integration connection"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): GmailDraftOutputConfig {
        return new GmailDraftOutputConfig("example")
    }

    async validateConfig(output: GmailDraftOutputConfig, _userId: string): Promise<void> {
        GmailDraftOutputConfigSchema.parse(stripConfigForValidation(output))
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, _output: GmailDraftOutputConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_output_id: channelOutputId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: GmailDraftOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Gmail Draft configs provided")
        }

        const sections: string[] = []

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            configList.push(`  - Integration ID: ${config.integrationId}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Gmail Draft tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("\n" + GMAIL_DRAFT_OUTPUT_INSTRUCTIONS)

        return sections.join("\n")
    }
}

const GMAIL_DRAFT_OUTPUT_INSTRUCTIONS = `
=== GMAIL DRAFT OUTPUT ===

TOOL:
- gmail_create_draft: Create draft emails in Gmail for human review before sending.

DRAFT TYPES:
- New draft: Create a new draft email by providing \`to\`, \`subject\`, and at least one of \`body\` or \`html_body\`. Leave \`thread_id\` empty.
- Draft reply: Create a draft reply to an existing email by providing \`thread_id\` (the Gmail Thread ID from the email event, NOT the Message-ID) along with \`to\`, \`subject\`, and at least one of \`body\` or \`html_body\`.

BODY FORMATS:
- Plain text: Provide \`body\`.
- HTML: Provide \`html_body\`.
- Best compatibility: Provide both \`body\` and \`html_body\` to create a multipart/alternative draft.

IMPORTANT: The \`thread_id\` parameter must be the Gmail Thread ID (a numeric string like "1234567890"), NOT the Message-ID header (which looks like "<...@mail.gmail.com>").

WORKFLOW:
- You create drafts — the human reviews and sends them manually from Gmail.
- After creating a draft, share the \`draft_url\` so the user can review it.
- If you have a Slack output, you can share the draft URL via Slack for easy access.

BEST PRACTICES:
- Always provide clear, concise subject lines
- For replies, use the Thread ID from the incoming email event (not the Message-ID)
- Prefer including both \`body\` and \`html_body\` for client compatibility
- Include relevant context in replies by referencing the original email
- Always share the draft URL so the user can find and review the draft

USER-FACING RESPONSE STYLE:
- After creating a draft, confirm the outcome succinctly in user-facing language.
- Do NOT mention low-level implementation details unless explicitly asked (for example: CID/content-id, MIME/base64 internals, replacement image URLs, attachment plumbing).
- If the user explicitly asks for technical/debug details, you may provide those details.
`.trim()
