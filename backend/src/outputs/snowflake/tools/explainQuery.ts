import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolOutputByName } from "../../../shared/types"
import { ToolName } from "../../../tools/ToolNames"
import { toolOutput } from "../../../tools/toolOutput"
import { SessionToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"
import { getSnowflakeCredentials, runSnowflakeQuery } from "../snowflakeClient"

const snowflakeExplainQueryParams = z.object({
    integrationId: z.string().describe("The integration ID of the Snowflake connection to use."),
    query: z.string().describe("The SQL query to explain.")
})

export const snowflakeExplainQueryTool: SessionToolOptions<typeof snowflakeExplainQueryParams> = {
    name: ToolName.SNOWFLAKE_EXPLAIN_QUERY,
    description: "Get the query execution plan for a Snowflake SQL query using EXPLAIN. Use this to understand how Snowflake will execute a query before running it.",
    parameters: snowflakeExplainQueryParams,
    execute: async ({ integrationId, query }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const credentials = await getSnowflakeCredentials(integrationId, organizationId)

        const explainSql = `EXPLAIN ${query}`

        logger.info("Executing Snowflake EXPLAIN query", { integrationId, query: explainSql.substring(0, 200) })

        try {
            const result = await runSnowflakeQuery(credentials, explainSql)

            const action = {
                action: "Explained Snowflake query",
                integration: IntegrationType.SNOWFLAKE,
                target: `Snowflake (account: ${credentials.accountIdentifier})`,
                details: `EXPLAIN returned ${result.rowCount} row${result.rowCount !== 1 ? "s" : ""}`,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return toolOutput(ToolName.SNOWFLAKE_EXPLAIN_QUERY, {
                success: true,
                explainPlan: result.rows,
                columns: result.columns,
                rowCount: result.rowCount,
                actions: [action]
            })
        } catch (error: any) {
            logger.error("Snowflake EXPLAIN query failed", { error: error.message, integrationId })
            throw new Error(`Failed to explain Snowflake query: ${error.message}`)
        }
    }
}
