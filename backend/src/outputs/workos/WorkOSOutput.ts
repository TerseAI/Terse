import { OutputConfigType } from "@prisma/client"

import { Output, ToolboxEntry } from "../../outputs/abstract/Output"
import { WorkOSOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { WorkOSOutputConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"

import { getWorkOSUserTool } from "./tools/getUser"
import { listWorkOSOrganizationsTool } from "./tools/listOrganizations"
import { listWorkOSUsersTool } from "./tools/listUsers"

export class WorkOSOutput extends Output<WorkOSOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: listWorkOSUsersTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List users" },
            { tool: listWorkOSOrganizationsTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List organizations" },
            { tool: getWorkOSUserTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "Get user" }
        ]

        super(OutputConfigType.WORKOS, toolbox)
    }

    protected getDummyConfigForCapability(): WorkOSOutputConfig {
        return new WorkOSOutputConfig("example")
    }

    async validateConfig(output: WorkOSOutputConfig, _userId: string): Promise<void> {
        WorkOSOutputConfigSchema.parse(stripConfigForValidation(output))
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, _output: WorkOSOutputConfig): Promise<void> {
        await tx.automation_workos_output_configs.create({
            data: {
                automation_output_id: channelOutputId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: WorkOSOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No WorkOS output configs provided")
        }

        const sections: string[] = []

        sections.push("=== WORKOS OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            configList.push(`  • Integration ID: ${config.integrationId}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling WorkOS tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
