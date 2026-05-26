import { OutputConfigType } from "@prisma/client"
import { SnowflakeOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { snowflakeExecuteQueryTool } from "./tools/executeQuery"
import { snowflakeExplainQueryTool } from "./tools/explainQuery"

export class SnowflakeSkillOutput extends Output<SnowflakeOutputConfig> {
    constructor() {
        super(OutputConfigType.SNOWFLAKE, [
            { tool: snowflakeExplainQueryTool, isReadOnly: true, integration: IntegrationType.SNOWFLAKE, displayName: "Explain query", validateACL: unrestricted },
            {
                tool: snowflakeExecuteQueryTool,
                isReadOnly: true,
                supportsApproval: true,
                integration: IntegrationType.SNOWFLAKE,
                displayName: "Execute query",
                validateACL: unrestricted
            }
        ])
    }

    async validateConfig(output: SnowflakeOutputConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: SnowflakeOutputConfig): Promise<void> {
        await tx.automation_snowflake_configs.create({
            data: {
                automation_output_id: agentOutputId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: SnowflakeOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Snowflake skill configs provided")
        }

        const sections: string[] = []
        sections.push("=== SNOWFLAKE SKILL (READ-ONLY) ===")
        sections.push("Available configurations:")

        for (const config of configs) {
            const parts = [`  • Integration ID: ${config.integrationId}`]
            sections.push(parts.join(", "))
        }

        sections.push("\nWhen calling Snowflake tools, include integrationId from a configured entry.")
        sections.push("Tools: snowflakeExecuteQuery (run SELECT queries), snowflakeExplainQuery (get execution plan)")
        sections.push("These tools are read-only. SQL safety is enforced by the Snowflake role configured for the integration.")

        return sections.join("\n")
    }
}
