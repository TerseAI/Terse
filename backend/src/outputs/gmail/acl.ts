import { IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

export const validateGmailSendACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.GMAIL,
        integrationId: args.integrationId,
        resourceType: "send",
        resourceId: "send"
    })

    return allowed
        ? { ok: true }
        : {
              ok: false,
              message: `Gmail ACL denied: sending email is not configured for integration ${args.integrationId}.`
          }
}

export const validateGmailDraftACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.GMAIL,
        integrationId: args.integrationId,
        resourceType: "draft",
        resourceId: "draft"
    })

    return allowed
        ? { ok: true }
        : {
              ok: false,
              message: `Gmail ACL denied: creating drafts is not configured for integration ${args.integrationId}.`
          }
}
