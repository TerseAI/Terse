import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { ToolboxEntry } from "../../outputs/abstract/Output"
import { db } from "../../prismaClient"
import { SlackKBConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { slackListChannelsTool } from "./tools/listChannels"
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
                tool: slackReadConversationTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.SLACK,
                displayName: "Read conversation"
            }
        ]

        super(KnowledgeBaseConfigType.SLACK, toolbox)
    }

    async validateConfig(knowledgeBase: SlackKBConfig, _userId: string): Promise<void> {
        const allowDms = knowledgeBase.allowDms === true
        const hasUserFilter = (knowledgeBase.userIds?.length ?? 0) > 0
        if (allowDms || hasUserFilter) {
            const usi = await db().user_slack_integrations.findUnique({
                where: { id: knowledgeBase.integrationId }
            })
            if (usi?.is_bot_user) {
                throw new Error("Including DMs in search or filtering by users requires a Slack user token. Reconnect Slack with a user token.")
            }
        }
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: SlackKBConfig): Promise<void> {
        await tx.automation_slack_kb_configs.create({
            data: {
                automation_knowledge_base_id: agentKnowledgeBaseId,
                channel_ids: knowledgeBase.channelIds ?? [],
                channel_names: knowledgeBase.channelNames ?? [],
                allow_dms: knowledgeBase.allowDms ?? false,
                user_ids: knowledgeBase.userIds ?? [],
                user_names: knowledgeBase.userNames ?? []
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
            if (c.channel_names?.length) {
                parts.push(`Channels: ${c.channel_names.join(", ")}`)
            }
            if (c.allow_dms) {
                parts.push("DMs: allowed")
            }
            if (c.user_names?.length) {
                parts.push(`Users: ${c.user_names.join(", ")}`)
            }
            configList.push(`  • ${parts.join(" - ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push(`
AVAILABLE TOOLS:
• slack_list_channels: List available channels and DMs. Use to discover channel IDs.
• slack_read_conversation: Read message history from a channel or DM. Use channel ID from slack_list_channels.`)
        return sections.join("\n")
    }
}
