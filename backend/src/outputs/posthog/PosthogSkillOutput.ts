import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { PosthogConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validatePosthogProjectExists } from "../../integrations/PosthogIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolboxEntry } from "../abstract/Output"

import { getSessionEventsTool } from "./tools/getSessionEvents"
import { searchEventsTool } from "./tools/searchEvents"
import { searchLogsTool } from "./tools/searchLogs"
import { searchSessionsTool } from "./tools/searchSessions"

export class PosthogSkillOutput extends Output<PosthogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: searchLogsTool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search logs" },
            { tool: searchSessionsTool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search sessions" },
            { tool: getSessionEventsTool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Get session events" },
            { tool: searchEventsTool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search events" }
        ]

        super(OutputConfigType.POSTHOG, toolbox)
    }

    protected getDummyConfigForCapability(): PosthogConfig {
        return new PosthogConfig("example", "example-project", "Example Project")
    }

    async validateConfig(output: PosthogConfig, _userId: string): Promise<void> {
        await validatePosthogProjectExists(output.integrationId, output.projectId)
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: PosthogConfig): Promise<void> {
        await tx.automation_posthog_configs.create({
            data: {
                automation_output_id: agentOutputId,
                project_id: output.projectId,
                project_name: output.projectName || null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: PosthogConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No PostHog skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== POSTHOG SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            sections.push(`  • Integration ID: ${config.integrationId} - Project Name: ${config.projectName || "N/A"}, Project ID: ${config.projectId || "N/A"}`)
        }

        sections.push("\nWhen calling PostHog tools, include integrationId and projectId from a configured entry.")
        sections.push("Tools: searchPosthogLogs, searchPosthogSessions, getPosthogSessionEvents, searchPosthogEvents")
        sections.push("Use these tools for investigation and evidence gathering; they are read-only.")

        return sections.join("\n")
    }
}
