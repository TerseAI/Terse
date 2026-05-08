import { IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator, denyToolACL } from "../abstract/Output"

export const validatePostHogProjectACL: ToolACLValidator<{ integrationId: string; projectId: string }> = ({ args, aclRules, configs: _configs }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.POSTHOG,
        integrationId: args.integrationId,
        resourceType: "project",
        resourceId: args.projectId
    })

    return allowed ? { ok: true } : denyToolACL(`PostHog ACL denied: project ${args.projectId} is not configured for this run.`)
}
