import { IntegrationType, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator, denyToolACL } from "../abstract/Output"

export const validateSnowflakeIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    const allowed = hasAnyACLRuleForIntegration({
        rules: aclRules,
        integrationType: IntegrationType.SNOWFLAKE,
        integrationId: args.integrationId
    })

    return allowed ? { ok: true } : denyToolACL(`Snowflake ACL denied: integration ${args.integrationId} is not configured for this run.`)
}
