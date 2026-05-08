import { ACLRule, IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import { ToolACLValidator, denyToolACL } from "../abstract/Output"

function hasWorkOSIntegrationACL(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return (
        hasACLRule(params.aclRules, {
            integrationType: IntegrationType.WORKOS,
            integrationId: params.integrationId,
            resourceType: "integration",
            resourceId: params.integrationId
        }) ||
        hasAnyACLRuleForIntegration({
            rules: params.aclRules,
            integrationType: IntegrationType.WORKOS,
            integrationId: params.integrationId
        })
    )
}

function workosHasAnyOrganizationRules(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return params.aclRules.some(rule => rule.integrationType === IntegrationType.WORKOS && rule.integrationId === params.integrationId && rule.resourceType === "organization")
}

function hasWorkOSOrganizationACL(params: { aclRules: ACLRule[]; integrationId: string; organizationId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.WORKOS,
        integrationId: params.integrationId,
        resourceType: "organization",
        resourceId: params.organizationId
    })
}

export const validateWorkOSIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    return hasWorkOSIntegrationACL({ aclRules, integrationId: args.integrationId })
        ? { ok: true }
        : denyToolACL(`WorkOS ACL denied: integration ${args.integrationId} is not configured for this run.`)
}

export const validateWorkOSListUsersACL: ToolACLValidator<{ integrationId: string; organizationId?: string | null }> = ({ args, aclRules, configs: _configs }) => {
    if (!hasWorkOSIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return denyToolACL(`WorkOS ACL denied: integration ${args.integrationId} is not configured for this run.`)
    }
    if (args.organizationId && workosHasAnyOrganizationRules({ aclRules, integrationId: args.integrationId })) {
        if (!hasWorkOSOrganizationACL({ aclRules, integrationId: args.integrationId, organizationId: args.organizationId })) {
            return denyToolACL(`WorkOS ACL denied: organization ${args.organizationId} is not configured for this run.`)
        }
    }
    return { ok: true }
}
