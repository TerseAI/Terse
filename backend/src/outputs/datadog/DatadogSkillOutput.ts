import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { validateDatadogIndexesExist } from "../../integrations/DatadogIntegration"
import { DatadogConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { DatadogConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { aggregateRumEventsTool } from "./tools/aggregateRumEvents"
import { listRumEventsTool } from "./tools/listRumEvents"
import { searchDatadogLogsTool } from "./tools/searchLogs"
import { searchRumEventsTool } from "./tools/searchRumEvents"

export class DatadogSkillOutput extends Output<DatadogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: searchDatadogLogsTool as Tool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search logs" },
            { tool: listRumEventsTool as Tool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "List events" },
            { tool: searchRumEventsTool as Tool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search RUM events" },
            { tool: aggregateRumEventsTool as Tool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Aggregate RUM events" }
        ]

        super(OutputConfigType.DATADOG, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.DATADOG)
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
                integrationId: "Datadog integration connection",
                defaultIndexes: 'Log indexes to search by default (e.g. ["main"])'
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): DatadogConfig {
        return new DatadogConfig("example", ["main"])
    }

    async validateConfig(output: DatadogConfig, _userId: string): Promise<void> {
        DatadogConfigSchema.parse(stripConfigForValidation(output))
        const indexes = output.defaultIndexes?.length ? output.defaultIndexes : ["main"]
        await validateDatadogIndexesExist(output.integrationId, indexes)
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: DatadogConfig): Promise<void> {
        await tx.automation_datadog_configs.create({
            data: {
                automation_output_id: agentOutputId,
                default_indexes: output.defaultIndexes?.length ? output.defaultIndexes : ["main"]
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: DatadogConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Datadog skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== DATADOG SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            const indexes = config.defaultIndexes || ["main"]
            sections.push(`  • Integration ID: ${config.integrationId} - Default indexes: ${indexes.join(", ")}`)
        }

        sections.push("\nWhen calling Datadog tools, include integrationId from a configured entry.")
        sections.push("Tools: searchDatadogLogs, listRumEvents, searchRumEvents, aggregateRumEvents")
        sections.push("Use these tools for log and RUM investigation; they are read-only.")

        return sections.join("\n")
    }
}
