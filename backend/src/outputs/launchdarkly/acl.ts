import { ACLRule, IntegrationType, getACLRulesForResourceType, hasACLRule } from "terse-types"

import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, denyToolACL } from "../abstract/Output"

function launchDarklyEnvironmentResourceId(params: { projectKey: string; environmentKey: string }): string {
    return `${params.projectKey}:${params.environmentKey}`
}

function hasLaunchDarklyProjectACL(params: { aclRules: ACLRule[]; integrationId: string; projectKey: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.LAUNCHDARKLY,
        integrationId: params.integrationId,
        resourceType: "project",
        resourceId: params.projectKey
    })
}

function checkEnvironmentSubset(params: { aclRules: ACLRule[]; integrationId: string; projectKey: string; requestedEnvironmentKeys: string[] }): ToolACLValidationResult {
    const envRules = getACLRulesForResourceType({
        rules: params.aclRules,
        integrationType: IntegrationType.LAUNCHDARKLY,
        integrationId: params.integrationId,
        resourceType: "environment"
    })
    if (envRules.length === 0) {
        return { ok: true }
    }
    const allowedEnvironments = new Set(envRules.map((rule: ACLRule) => rule.resourceId))
    const denied = params.requestedEnvironmentKeys.filter(key => {
        const resourceId = launchDarklyEnvironmentResourceId({
            projectKey: params.projectKey,
            environmentKey: key
        })
        return !allowedEnvironments.has(resourceId)
    })
    if (denied.length === 0) {
        return { ok: true }
    }
    return denyToolACL(`LaunchDarkly ACL denied: environments not configured for this run: ${denied.join(", ")}.`)
}

export const validateLaunchDarklyListFlagsACL: ToolACLValidator<{
    integrationId: string
    projectKey: string
    environmentKeys: string[]
}> = ({ args, aclRules, configs: _configs }) => {
    if (!hasLaunchDarklyProjectACL({ aclRules, integrationId: args.integrationId, projectKey: args.projectKey })) {
        return denyToolACL(`LaunchDarkly ACL denied: project ${args.projectKey} is not configured for this run.`)
    }
    return checkEnvironmentSubset({
        aclRules,
        integrationId: args.integrationId,
        projectKey: args.projectKey,
        requestedEnvironmentKeys: args.environmentKeys ?? []
    })
}

export const validateLaunchDarklyGetFlagDetailsACL: ToolACLValidator<{
    integrationId: string
    projectKey: string
    environmentKeys: string[]
    environmentKey?: string | null
}> = ({ args, aclRules, configs: _configs }) => {
    if (!hasLaunchDarklyProjectACL({ aclRules, integrationId: args.integrationId, projectKey: args.projectKey })) {
        return denyToolACL(`LaunchDarkly ACL denied: project ${args.projectKey} is not configured for this run.`)
    }
    const requested = [...(args.environmentKeys ?? [])]
    if (args.environmentKey) {
        requested.push(args.environmentKey)
    }
    return checkEnvironmentSubset({
        aclRules,
        integrationId: args.integrationId,
        projectKey: args.projectKey,
        requestedEnvironmentKeys: requested
    })
}
