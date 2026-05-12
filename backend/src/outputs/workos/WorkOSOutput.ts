import { OutputConfigType } from "@prisma/client"
import { WorkOSOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"

import { Output, ToolACLValidator, defineToolEntry } from "../../outputs/abstract/Output"
import { PrismaTransaction } from "../../types/prisma"

import { getWorkOSUserTool } from "./tools/getUser"
import { listWorkOSOrganizationsTool } from "./tools/listOrganizations"
import { listWorkOSUsersTool } from "./tools/listUsers"

export class WorkOSOutput extends Output<WorkOSOutputConfig> {
    constructor() {
        const t = defineToolEntry<WorkOSOutputConfig>()
        const toolbox = [
            t({ tool: listWorkOSUsersTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List users", validateACL: validateListWorkOSUsers }),
            t({ tool: listWorkOSOrganizationsTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List organizations", validateACL: validateListWorkOSOrganizations }),
            t({ tool: getWorkOSUserTool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "Get user", validateACL: validateGetWorkOSUser })
        ]

        super(OutputConfigType.WORKOS, toolbox)
    }

    protected getDummyConfigForCapability(): WorkOSOutputConfig {
        return new WorkOSOutputConfig("example")
    }

    async validateConfig(output: WorkOSOutputConfig, _userId: string): Promise<void> {}

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

type WorkOSACL<TName extends ToolName> = ToolACLValidator<TName, WorkOSOutputConfig>

const validateListWorkOSUsers: WorkOSACL<"listWorkOSUsers"> = _params => ({ ok: true as const })
const validateListWorkOSOrganizations: WorkOSACL<"listWorkOSOrganizations"> = _params => ({ ok: true as const })
const validateGetWorkOSUser: WorkOSACL<"getWorkOSUser"> = _params => ({ ok: true as const })
