import { ACLRule, IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

function hasAttioIntegrationACL(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return (
        hasACLRule(params.aclRules, {
            integrationType: IntegrationType.ATTIO,
            integrationId: params.integrationId,
            resourceType: "integration",
            resourceId: params.integrationId
        }) ||
        hasAnyACLRuleForIntegration({
            rules: params.aclRules,
            integrationType: IntegrationType.ATTIO,
            integrationId: params.integrationId
        })
    )
}

function attioHasAnyObjectRules(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return params.aclRules.some(rule => rule.integrationType === IntegrationType.ATTIO && rule.integrationId === params.integrationId && rule.resourceType === "object")
}

function hasAttioObjectACL(params: { aclRules: ACLRule[]; integrationId: string; objectSlug: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.ATTIO,
        integrationId: params.integrationId,
        resourceType: "object",
        resourceId: params.objectSlug
    })
}

export const validateAttioIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    return hasAttioIntegrationACL({ aclRules, integrationId: args.integrationId })
        ? { ok: true }
        : {
              ok: false,
              message: `Attio ACL denied: integration ${args.integrationId} is not configured for this run.`
          }
}

export const validateAttioObjectACL: ToolACLValidator<{ integrationId: string; objectSlug: string }> = ({ args, aclRules }) => {
    if (!hasAttioIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return {
            ok: false,
            message: `Attio ACL denied: integration ${args.integrationId} is not configured for this run.`
        }
    }
    if (attioHasAnyObjectRules({ aclRules, integrationId: args.integrationId })) {
        if (!hasAttioObjectACL({ aclRules, integrationId: args.integrationId, objectSlug: args.objectSlug })) {
            return {
                ok: false,
                message: `Attio ACL denied: object ${args.objectSlug} is not configured for this run.`
            }
        }
    }
    return { ok: true }
}
