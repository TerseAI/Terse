import { ACLRule, IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

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

function validateAttioObjectScope(params: { args: { integrationId: string; objectSlug: string }; aclRules: ACLRule[] }): ToolACLValidationResult {
    if (!hasAttioIntegrationACL({ aclRules: params.aclRules, integrationId: params.args.integrationId })) {
        return denyToolACL(`Attio ACL denied: integration ${params.args.integrationId} is not configured for this run.`)
    }
    if (attioHasAnyObjectRules({ aclRules: params.aclRules, integrationId: params.args.integrationId })) {
        if (!hasAttioObjectACL({ aclRules: params.aclRules, integrationId: params.args.integrationId, objectSlug: params.args.objectSlug })) {
            return denyToolACL(`Attio ACL denied: object ${params.args.objectSlug} is not configured for this run.`)
        }
    }
    return { ok: true }
}

export const validateAttioIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    return hasAttioIntegrationACL({ aclRules, integrationId: args.integrationId }) ? { ok: true } : denyToolACL(`Attio ACL denied: integration ${args.integrationId} is not configured for this run.`)
}

export const validateAttioReadObjectACL: ToolACLValidator<{ integrationId: string; objectSlug: string }> = params => validateAttioObjectScope(params)

export const validateAttioWriteObjectACL: ToolACLValidator<{ integrationId: string; objectSlug: string }> = params => {
    if (!configIsWritableForIntegration({ configs: params.configs, integrationId: params.args.integrationId })) {
        return denyToolACL(`Attio ACL denied: integration ${params.args.integrationId} is read-only for this run.`)
    }
    return validateAttioObjectScope(params)
}
