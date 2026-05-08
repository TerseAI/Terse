import { ACLRule, IntegrationType, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

function hasDatadogIntegrationACL(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return hasAnyACLRuleForIntegration({
        rules: params.aclRules,
        integrationType: IntegrationType.DATADOG,
        integrationId: params.integrationId
    })
}

function getDatadogIndexRules(params: { aclRules: ACLRule[]; integrationId: string }): ACLRule[] {
    return params.aclRules.filter(rule => rule.integrationType === IntegrationType.DATADOG && rule.integrationId === params.integrationId && rule.resourceType === "index")
}

export const validateDatadogIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    return hasDatadogIntegrationACL({ aclRules, integrationId: args.integrationId })
        ? { ok: true }
        : {
              ok: false,
              message: `Datadog ACL denied: integration ${args.integrationId} is not configured for this run.`
          }
}

export const validateDatadogLogsACL: ToolACLValidator<{ integrationId: string; indexes?: string[] | null; defaultIndexes?: string[] | null }> = ({ args, aclRules }) => {
    if (!hasDatadogIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return {
            ok: false,
            message: `Datadog ACL denied: integration ${args.integrationId} is not configured for this run.`
        }
    }

    const indexRules = getDatadogIndexRules({ aclRules, integrationId: args.integrationId })
    if (indexRules.length === 0) {
        return { ok: true }
    }

    const requestedIndexes = (args.indexes && args.indexes.length > 0 ? args.indexes : undefined) ?? (args.defaultIndexes && args.defaultIndexes.length > 0 ? args.defaultIndexes : undefined)

    if (!requestedIndexes || requestedIndexes.length === 0) {
        return {
            ok: false,
            message: "Datadog ACL denied: this scoped Datadog config requires explicit indexes."
        }
    }

    const allowedIndexes = new Set(indexRules.map(rule => rule.resourceId))
    const deniedIndexes = requestedIndexes.filter(index => !allowedIndexes.has(index))

    return deniedIndexes.length === 0
        ? { ok: true }
        : {
              ok: false,
              message: `Datadog ACL denied: indexes not configured for this run: ${deniedIndexes.join(", ")}.`
          }
}
