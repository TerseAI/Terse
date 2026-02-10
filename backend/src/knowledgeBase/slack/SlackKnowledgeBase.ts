import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { buildDummyKnowledgeBaseConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigType, SlackKBConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { slackListChannelsTool } from "./tools/listChannels"
import { slackListUsersTool } from "./tools/listUsers"
import { slackReadConversationTool } from "./tools/readConversation"

/**
 * Slack Knowledge Base implementation.
 * Provides tools to list channels and read conversation history (channels, DMs, group DMs).
 */
export class SlackKnowledgeBase extends KnowledgeBase<SlackKBConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: slackListChannelsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.SLACK,
                displayName: "List channels"
            },
            {
                tool: slackListUsersTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.SLACK,
                displayName: "List users"
            },
            {
                tool: slackReadConversationTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.SLACK,
                displayName: "Read conversation"
            }
        ]

        super(KnowledgeBaseConfigType.SLACK, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.SLACK_KB)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.SLACK_KB,
            integrationType: meta.integrationType,
            role: CapabilityRole.KNOWLEDGE_BASE,
            tools,
            configFields: {
                integrationId: "Slack integration connection",
                channelIds: "Slack channel IDs to read (optional; omit for all accessible channels)",
                allowDms: "Whether to allow reading DMs",
                userIds: "Specific Slack user IDs to filter DM conversations (optional)"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs {
        return buildDummyKnowledgeBaseConfig("example", {
            config_type: KnowledgeBaseConfigType.SLACK,
            slack_kb_config: {
                channel_ids: ["C123"],
                allow_dms: false,
                user_ids: []
            }
        })
    }

    async validateConfig(_knowledgeBase: SlackKBConfig, _userId: string): Promise<void> {
        // Bot and user tokens both support channels, DMs, and user filters; token type only affects scope (what is visible).
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: SlackKBConfig): Promise<void> {
        await tx.automation_slack_kb_configs.create({
            data: {
                automation_knowledge_base_id: agentKnowledgeBaseId,
                channel_ids: knowledgeBase.channelIds ?? [],
                channel_names: [], // IDs only; hydrate via UI or slack_list_users tool
                allow_dms: knowledgeBase.allowDms ?? false,
                user_ids: knowledgeBase.userIds ?? [],
                user_names: [] // IDs only; hydrate via UI or slack_list_users tool
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Slack KB configs provided")
        }

        const sections: string[] = []
        sections.push("=== SLACK KNOWLEDGE BASE ===")

        const configList: string[] = []
        for (const config of configs) {
            if (!config.slack_kb_config) {
                throw new Error("Slack KB config not found")
            }
            const c = config.slack_kb_config
            const parts = [`Integration ID: ${config.integration_id}`]
            if (c.channel_ids?.length) {
                parts.push(`Channel IDs: ${c.channel_ids.join(", ")}`)
            }
            if (c.allow_dms) {
                parts.push("DMs: allowed")
            }
            if (c.user_ids?.length) {
                parts.push(`Filter to user IDs: ${c.user_ids.join(", ")}`)
            }
            configList.push(`  • ${parts.join(" - ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push(`
Use slack_list_users to resolve Slack user IDs to names when needed.

AVAILABLE TOOLS:
• slack_list_channels: List available channels and DMs. Use to discover channel IDs.
• slack_list_users: List workspace users (id and name). Use to resolve user IDs to names.
• slack_read_conversation: Read message history from a channel or DM. Use channel ID from slack_list_channels.`)
        return sections.join("\n")
    }
}
