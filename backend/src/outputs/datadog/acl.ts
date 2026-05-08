import { ACLRule, IntegrationType, getACLRulesForResourceType, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator, denyToolACL } from "../abstract/Output"

function hasDatadogIntegrationACL(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return hasAnyACLRuleForIntegration({
        rules: params.aclRules,
        integrationType: IntegrationType.DATADOG,
        integrationId: params.integrationId
    })
}

export const validateDatadogIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    return hasDatadogIntegrationACL({ aclRules, integrationId: args.integrationId })
        ? { ok: true }
        : denyToolACL(`Datadog ACL denied: integration ${args.integrationId} is not configured for this run.`)
}

export const validateDatadogLogsACL: ToolACLValidator<{
    integrationId: string
    indexes?: string[] | null
    defaultIndexes?: string[] | null
}> = ({ args, aclRules, configs: _configs }) => {
    if (!hasDatadogIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return denyToolACL(`Datadog ACL denied: integration ${args.integrationId} is not configured for this run.`)
    }

    const indexRules = getACLRulesForResourceType({
        rules: aclRules,
        integrationType: IntegrationType.DATADOG,
        integrationId: args.integrationId,
        resourceType: "index"
    })
    if (indexRules.length === 0) {
        return { ok: true }
    }

    const requestedIndexes = (args.indexes && args.indexes.length > 0 ? args.indexes : undefined) ?? (args.defaultIndexes && args.defaultIndexes.length > 0 ? args.defaultIndexes : undefined)

    if (!requestedIndexes || requestedIndexes.length === 0) {
        return denyToolACL("Datadog ACL denied: this scoped Datadog config requires explicit indexes.")
    }

    const allowedIndexes = new Set(indexRules.map((rule: ACLRule) => rule.resourceId))
    const deniedIndexes = requestedIndexes.filter(index => !allowedIndexes.has(index))

    return deniedIndexes.length === 0
        ? { ok: true }
        : denyToolACL(`Datadog ACL denied: indexes not configured for this run: ${deniedIndexes.join(", ")}.`)
}
