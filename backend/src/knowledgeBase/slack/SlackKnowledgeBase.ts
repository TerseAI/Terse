import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { buildDummyKnowledgeBaseConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { getSlackAccessTokenOrThrow, validateSlackChannelsExist, validateSlackUserIds } from "../../integrations/SlackIntegration"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigType, SlackKBConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { SlackKnowledgeBaseConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
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
                channelId: "Selected channel ID when mode is Channels. User selects one channel or DMs; if Channels, one channel required.",
                allowDms: "True when mode is Direct messages. If DMs, user can optionally select users (empty = all DMs).",
                userIds: "When allowDms is true: optional user IDs to restrict to those DMs; leave empty to read all DMs."
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

    async validateConfig(knowledgeBase: SlackKBConfig, _userId: string): Promise<void> {
        SlackKnowledgeBaseConfigSchema.parse(stripConfigForValidation(knowledgeBase))
        const hasChannel = !!knowledgeBase.channelId?.trim()
        const isDmsMode = knowledgeBase.allowDms === true
        if (!hasChannel && !isDmsMode) {
            throw new Error("Slack knowledge base requires selecting a channel or DMs. If Channel, select one channel. If DMs, that alone is valid (all DMs); you may optionally select users.")
        }
        if (hasChannel && isDmsMode) {
            throw new Error("Slack knowledge base must be either Channel or DMs, not both. Clear channel when using DMs, or switch to Channel and select one channel.")
        }
        if (hasChannel || (isDmsMode && (knowledgeBase.userIds?.length ?? 0) > 0)) {
            const token = await getSlackAccessTokenOrThrow(knowledgeBase.integrationId)
            await validateSlackChannelsExist(token, hasChannel ? [knowledgeBase.channelId!] : [])
            await validateSlackUserIds(token, knowledgeBase.userIds ?? [])
        }
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: SlackKBConfig): Promise<void> {
        await tx.automation_slack_kb_configs.create({
            data: {
                automation_knowledge_base_id: agentKnowledgeBaseId,
                channel_ids: knowledgeBase.channelId ? [knowledgeBase.channelId] : [],
                channel_names: [], // Display names not persisted; UI sends channelName for display only.
                allow_dms: knowledgeBase.allowDms ?? false,
                user_ids: knowledgeBase.userIds ?? [],
                user_names: [] // Display names not persisted; UI sends userNames for display only.
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
            const channelId = c.channel_ids?.[0]
            if (channelId) {
                parts.push(`Channel ID: ${channelId}`)
            }
            if (c.allow_dms) {
                parts.push(c.user_ids?.length ? `DMs: filter to user IDs ${c.user_ids.join(", ")}` : "DMs: all")
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
