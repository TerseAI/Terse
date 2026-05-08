import { IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

export const validateGmailSendACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyToolACL(`Gmail ACL denied: integration ${args.integrationId} is read-only for this run.`)
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
        return denyToolACL(`Gmail ACL denied: integration ${args.integrationId} is read-only for this run.`)
    }
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.GMAIL,
        integrationId: args.integrationId,
        resourceType: "draft",
        resourceId: "draft"
    })

    return allowed ? { ok: true } : denyToolACL(`Gmail ACL denied: creating drafts is not configured for integration ${args.integrationId}.`)
}
