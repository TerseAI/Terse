import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { SessionToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { getSnowflakeCredentials, runSnowflakeQuery } from "../snowflakeClient"

const snowflakeExecuteQueryParams = z.object({
    integrationId: z.string().describe("The integration ID of the Snowflake connection to use."),
    query: z.string().describe("The SQL query to execute. Should be a read-only SELECT statement.")
})

export const snowflakeExecuteQueryTool: SessionToolOptions<typeof snowflakeExecuteQueryParams, typeof ToolName.SNOWFLAKE_EXECUTE_QUERY> = {
    name: ToolName.SNOWFLAKE_EXECUTE_QUERY,
    description:
        "Execute a read-only SQL query against a Snowflake data warehouse. Returns rows and column metadata. SQL safety is enforced by the Snowflake role configured for the integration — use a read-only role.",
    parameters: snowflakeExecuteQueryParams,
    execute: async ({ integrationId, query }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const credentials = await getSnowflakeCredentials(integrationId, organizationId)

        logger.info("Executing Snowflake query", { integrationId, query: query.substring(0, 200) })

        try {
            const result = await runSnowflakeQuery(credentials, query)

            const action = {
                action: "Queried Snowflake",
                integration: IntegrationType.SNOWFLAKE,
                target: `Snowflake (account: ${credentials.accountIdentifier})`,
                details: `Query returned ${result.rowCount} row${result.rowCount !== 1 ? "s" : ""}`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                success: true,
                rows: result.rows,
                columns: result.columns,
                rowCount: result.rowCount,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Snowflake query execution failed", { error: error.message, integrationId })
            throw new Error(`Failed to execute Snowflake query: ${error.message}`)
        }
    }
}
