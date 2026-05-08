import { IntegrationType, hasACLRule } from "terse-types"

import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

function denyReadOnlyIntegration(integrationId: string): ToolACLValidationResult {
    return denyToolACL(`Gmail ACL denied: integration ${integrationId} is read-only for this run.`)
}

export const validateGmailSendACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyReadOnlyIntegration(args.integrationId)
    }
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.GMAIL,
        integrationId: args.integrationId,
        resourceType: "send",
        resourceId: "send"
    })

    return allowed ? { ok: true } : denyToolACL(`Gmail ACL denied: sending email is not configured for integration ${args.integrationId}.`)
}

export const validateGmailDraftACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyReadOnlyIntegration(args.integrationId)
    }
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.GMAIL,
        integrationId: args.integrationId,
        resourceType: "draft",
        resourceId: "draft"
    })

    return allowed ? { ok: true } : denyToolACL(`Gmail ACL denied: creating drafts is not configured for integration ${args.integrationId}.`)
}
