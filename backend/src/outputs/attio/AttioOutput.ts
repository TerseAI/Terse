import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { AttioIntegrationManager } from "../../integrations/AttioIntegration"
import { db } from "../../prismaClient"
import { AttioOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { AttioOutputConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { attioAssertRecordTool } from "./tools/assertRecord"
import { attioGetObjectSchemaTool } from "./tools/getObjectSchema"
import { attioListObjectsTool } from "./tools/listObjects"
import { attioQueryRecordsTool } from "./tools/queryRecords"

export class AttioOutput extends Output<AttioOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: attioListObjectsTool as Tool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "List objects" },
            { tool: attioGetObjectSchemaTool as Tool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Get object schema" },
            { tool: attioQueryRecordsTool as Tool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Query records" },
            { tool: attioAssertRecordTool as Tool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Assert record" }
        ]
        super(OutputConfigType.ATTIO, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.ATTIO)
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
                integrationId: "Attio integration connection",
                objectSlug: "Attio object type slug (e.g. people, companies)"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.ATTIO,
            attio_config: {
                object_slug: "people"
            }
        })
    }

    async validateConfig(output: AttioOutputConfig, _userId: string): Promise<void> {
        AttioOutputConfigSchema.parse(stripConfigForValidation(output))
        if (!output.objectSlug) {
            throw new Error("Invalid output config for attio_output: missing objectSlug")
        }

        // Validate the object exists in Attio
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(output.integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(output.objectSlug)}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!response.ok) {
            throw new Error(`Attio object "${output.objectSlug}" not found or not accessible`)
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: AttioOutputConfig): Promise<void> {
        await tx.automation_attio_configs.create({
            data: {
                automation_output_id: channelOutputId,
                object_slug: output.objectSlug || ""
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Attio configs provided")
        }

        const sections: string[] = []
        sections.push("=== ATTIO OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            if (!config.attio_config) {
                throw new Error("Attio config not found")
            }
            const objectSlug = config.attio_config.object_slug
            configList.push(`  - Integration ID: ${config.integration_id} - Object: ${objectSlug}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Attio tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("Use attio_get_object_schema to discover available attributes before creating/updating records.")
        sections.push("Use attio_query_records to find existing records before updating them.")

        return sections.join("\n")
    }
}
