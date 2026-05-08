import { OutputConfigType } from "@prisma/client"
import { AttioOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../../integrations/AttioIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, allConfigsReadOnly, defineToolboxEntry, formatConfigAccess, mixedReadWriteToolInstructionParagraph, outputHasMixedReadOnlyAndWritable } from "../abstract/Output"

import { validateAttioIntegrationACL, validateAttioReadObjectACL, validateAttioWriteObjectACL } from "./acl"
import { attioListObjectsTool } from "./tools/listObjects"
import { attioQueryRecordsTool } from "./tools/queryRecords"
import { attioUpsertRecordTool } from "./tools/upsertRecord"

export class AttioOutput extends Output<AttioOutputConfig> {
    constructor() {
        const toolbox = [
            defineToolboxEntry({
                tool: attioListObjectsTool,
                isReadOnly: true,
                integration: IntegrationType.ATTIO,
                displayName: "List objects",
                validateACL: validateAttioIntegrationACL
            }),
            defineToolboxEntry({
                tool: attioQueryRecordsTool,
                isReadOnly: true,
                integration: IntegrationType.ATTIO,
                displayName: "Query records",
                validateACL: validateAttioReadObjectACL
            }),
            defineToolboxEntry({
                tool: attioUpsertRecordTool,
                isReadOnly: false,
                integration: IntegrationType.ATTIO,
                displayName: "Upsert record",
                validateACL: validateAttioWriteObjectACL
            })
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

        const readOnly = allConfigsReadOnly(configs)

        const sections: string[] = []
        sections.push(readOnly ? "=== ATTIO OUTPUT (READ-ONLY) ===" : "=== ATTIO OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            const access = formatConfigAccess(config)
            const objectSlug = config.objectSlug
            configList.push(`  - Integration ID: ${config.integrationId}\n    Access: ${access}\n    Object: ${objectSlug}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        if (outputHasMixedReadOnlyAndWritable(configs)) {
            sections.push(mixedReadWriteToolInstructionParagraph())
        }
        sections.push("\nWhen calling Attio tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("Use attio_list_objects to discover available object types and their attributes.")
        if (readOnly) {
            sections.push("Use attio_query_records to read existing records.")
            sections.push("\nThis Attio integration is read-only for this run. Upserting records is not available.")
        } else {
            sections.push("Use attio_query_records to find existing records before updating them.")
        }

        return sections.join("\n")
    }
}
