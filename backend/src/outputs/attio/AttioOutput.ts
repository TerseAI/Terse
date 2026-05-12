import { OutputConfigType } from "@prisma/client"
import { AttioOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../../integrations/AttioIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { defineToolEntry } from "../abstract/acl"

import { attioListObjectsTool, validateAttioListObjects } from "./tools/listObjects"
import { attioQueryRecordsTool, validateAttioQueryRecords } from "./tools/queryRecords"
import { attioUpsertRecordTool, validateAttioUpsertRecord } from "./tools/upsertRecord"

export class AttioOutput extends Output<AttioOutputConfig> {
    constructor() {
        const t = defineToolEntry<AttioOutputConfig>()
        const toolbox = [
            t({ tool: attioListObjectsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "List objects", validateACL: validateAttioListObjects }),
            t({ tool: attioQueryRecordsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Query records", validateACL: validateAttioQueryRecords }),
            t({ tool: attioUpsertRecordTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Upsert record", validateACL: validateAttioUpsertRecord })
        ]
        super(OutputConfigType.ATTIO, toolbox)
    }

    protected getDummyConfigForCapability(): AttioOutputConfig {
        return new AttioOutputConfig("example", "people")
    }

    async validateConfig(output: AttioOutputConfig, _userId: string): Promise<void> {
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

    protected getSystemInstructionsForConfigs(configs: AttioOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Attio configs provided")
        }

        const sections: string[] = []
        sections.push("=== ATTIO OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            const objectSlug = config.objectSlug
            configList.push(`  - Integration ID: ${config.integrationId} - Object: ${objectSlug}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Attio tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("Use attio_list_objects to discover available object types and their attributes before creating/updating records.")
        sections.push("Use attio_query_records to find existing records before updating them.")

        return sections.join("\n")
    }
}
