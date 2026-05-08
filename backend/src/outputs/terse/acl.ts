import { IntegrationType, hasACLRule } from "terse-types"

import { ToolACLValidator, denyToolACL } from "../abstract/Output"

export const validateWebCapabilityACL: ToolACLValidator = ({ aclRules, configs: _configs }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.TERSE,
        integrationId: "system",
        resourceType: "web_capability",
        resourceId: "system"
    })

    return allowed ? { ok: true } : denyToolACL("Web ACL denied: web capability is not configured for this run.")
}

export const validateImageEditCapabilityACL: ToolACLValidator = ({ aclRules, configs: _configs }) => {
    const allowed = hasACLRule(aclRules, {
        integrationType: IntegrationType.TERSE,
        integrationId: "system",
        resourceType: "image_edit_capability",
        resourceId: "system"
    })

    return allowed ? { ok: true } : denyToolACL("Image edit ACL denied: image edit capability is not configured for this run.")
}
