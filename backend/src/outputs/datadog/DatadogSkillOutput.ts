import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { DatadogConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validateDatadogIndexesExist } from "../../integrations/DatadogIntegration"
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
            { tool: searchDatadogLogsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search logs" },
            { tool: listRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "List events" },
            { tool: searchRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search RUM events" },
            { tool: aggregateRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Aggregate RUM events" }
        ]

        super(OutputConfigType.DATADOG, toolbox)
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
