import { ACLRule, IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

function hasLaunchDarklyProjectACL(params: { aclRules: ACLRule[]; integrationId: string; projectKey: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.LAUNCHDARKLY,
        integrationId: params.integrationId,
        resourceType: "project",
        resourceId: params.projectKey
    })
}

function getLaunchDarklyEnvironmentRules(params: { aclRules: ACLRule[]; integrationId: string }): ACLRule[] {
    return params.aclRules.filter(rule => rule.integrationType === IntegrationType.LAUNCHDARKLY && rule.integrationId === params.integrationId && rule.resourceType === "environment")
}

function checkEnvironmentSubset(params: { aclRules: ACLRule[]; integrationId: string; requestedEnvironmentKeys: string[] }): { ok: true } | { ok: false; message: string } {
    const envRules = getLaunchDarklyEnvironmentRules({ aclRules: params.aclRules, integrationId: params.integrationId })
    if (envRules.length === 0) {
        return { ok: true }
    }
    const allowedEnvironments = new Set(envRules.map(rule => rule.resourceId))
    const denied = params.requestedEnvironmentKeys.filter(key => !allowedEnvironments.has(key))
    if (denied.length === 0) {
        return { ok: true }
    }
    return {
        ok: false,
        message: `LaunchDarkly ACL denied: environments not configured for this run: ${denied.join(", ")}.`
    }
}

export const validateLaunchDarklyListFlagsACL: ToolACLValidator<{ integrationId: string; projectKey: string; environmentKeys: string[] }> = ({ args, aclRules }) => {
    if (!hasLaunchDarklyProjectACL({ aclRules, integrationId: args.integrationId, projectKey: args.projectKey })) {
        return {
            ok: false,
            message: `LaunchDarkly ACL denied: project ${args.projectKey} is not configured for this run.`
        }
    }
    return checkEnvironmentSubset({ aclRules, integrationId: args.integrationId, requestedEnvironmentKeys: args.environmentKeys ?? [] })
}

export const validateLaunchDarklyGetFlagDetailsACL: ToolACLValidator<{ integrationId: string; projectKey: string; environmentKeys: string[]; environmentKey?: string | null }> = ({
    args,
    aclRules
}) => {
    if (!hasLaunchDarklyProjectACL({ aclRules, integrationId: args.integrationId, projectKey: args.projectKey })) {
        return {
            ok: false,
            message: `LaunchDarkly ACL denied: project ${args.projectKey} is not configured for this run.`
        }
    }
    const requested = [...(args.environmentKeys ?? [])]
    if (args.environmentKey) {
        requested.push(args.environmentKey)
    }
    return checkEnvironmentSubset({ aclRules, integrationId: args.integrationId, requestedEnvironmentKeys: requested })
}
