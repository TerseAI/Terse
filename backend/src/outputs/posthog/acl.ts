import { IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

export const validatePostHogProjectACL: ToolACLValidator<{ integrationId: string; projectId: string }> = ({ args, aclRules }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.POSTHOG,
        integrationId: args.integrationId,
        resourceType: "project",
        resourceId: args.projectId
    })

    return allowed
        ? { ok: true }
        : {
              ok: false,
              message: `PostHog ACL denied: project ${args.projectId} is not configured for this run.`
          }
}
