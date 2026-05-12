import { OutputConfigType } from "@prisma/client"
import { DatadogConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validateDatadogIndexesExist } from "../../integrations/DatadogIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"

import { aggregateRumEventsTool, validateAggregateRumEvents } from "./tools/aggregateRumEvents"
import { listRumEventsTool, validateListRumEvents } from "./tools/listRumEvents"
import { searchDatadogLogsTool, validateSearchDatadogLogs } from "./tools/searchLogs"
import { searchRumEventsTool, validateSearchRumEvents } from "./tools/searchRumEvents"

export class DatadogSkillOutput extends Output<DatadogConfig> {
    constructor() {
        const toolbox = [
            { tool: searchDatadogLogsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search logs", validateACL: validateSearchDatadogLogs },
            { tool: listRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "List events", validateACL: validateListRumEvents },
            { tool: searchRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Search RUM events", validateACL: validateSearchRumEvents },
            { tool: aggregateRumEventsTool, isReadOnly: true, integration: IntegrationType.DATADOG, displayName: "Aggregate RUM events", validateACL: validateAggregateRumEvents }
        ]

        super(OutputConfigType.DATADOG, toolbox)
    }

    async validateConfig(output: DatadogConfig, _userId: string): Promise<void> {
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
