import { IntegrationType, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

export const validateSnowflakeIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    const allowed = hasAnyACLRuleForIntegration({
        rules: aclRules,
        integrationType: IntegrationType.SNOWFLAKE,
        integrationId: args.integrationId
    })

    return allowed
        ? { ok: true }
        : {
              ok: false,
              message: `Snowflake ACL denied: integration ${args.integrationId} is not configured for this run.`
          }
}
