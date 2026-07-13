import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, SnowflakeOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { getSnowflakeCredentials, runSnowflakeQuery } from "../snowflakeClient"

export const snowflakeExplainQueryTool = defineSessionTool({
    name: "snowflakeExplainQuery",
    execute: async ({ integrationId, query }, runContext) => {
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

            return {
                success: true,
                explainPlan: result.rows,
                columns: result.columns,
                rowCount: result.rowCount,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Snowflake EXPLAIN query failed", { error: error.message, integrationId })
            throw new Error(`Failed to explain Snowflake query: ${error.message}`)
        }
    }
})
