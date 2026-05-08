import { ACLRule, IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

function hasLinearIntegrationACL(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return (
        hasACLRule(params.aclRules, {
            integrationType: IntegrationType.LINEAR,
            integrationId: params.integrationId,
            resourceType: "integration",
            resourceId: params.integrationId
        }) ||
        hasAnyACLRuleForIntegration({
            rules: params.aclRules,
            integrationType: IntegrationType.LINEAR,
            integrationId: params.integrationId
        })
    )
}

function linearHasAnyTeamRules(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return params.aclRules.some(rule => rule.integrationType === IntegrationType.LINEAR && rule.integrationId === params.integrationId && rule.resourceType === "team")
}

function linearHasAnyProjectRules(params: { aclRules: ACLRule[]; integrationId: string }): boolean {
    return params.aclRules.some(rule => rule.integrationType === IntegrationType.LINEAR && rule.integrationId === params.integrationId && rule.resourceType === "project")
}

function hasLinearTeamACL(params: { aclRules: ACLRule[]; integrationId: string; teamId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.LINEAR,
        integrationId: params.integrationId,
        resourceType: "team",
        resourceId: params.teamId
    })
}

function hasLinearProjectACL(params: { aclRules: ACLRule[]; integrationId: string; projectId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.LINEAR,
        integrationId: params.integrationId,
        resourceType: "project",
        resourceId: params.projectId
    })
}

function denyIntegration(integrationId: string): ToolACLValidationResult {
    return denyToolACL(`Linear ACL denied: integration ${integrationId} is not configured for this run.`)
}

export const validateLinearIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    return hasLinearIntegrationACL({ aclRules, integrationId: args.integrationId }) ? { ok: true } : denyIntegration(args.integrationId)
}

export const validateLinearTeamScopedACL: ToolACLValidator<{ integrationId: string; teamId?: string | null }> = ({ args, aclRules, configs: _configs }) => {
    if (!hasLinearIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return denyIntegration(args.integrationId)
    }
    if (args.teamId && linearHasAnyTeamRules({ aclRules, integrationId: args.integrationId })) {
        if (!hasLinearTeamACL({ aclRules, integrationId: args.integrationId, teamId: args.teamId })) {
            return denyToolACL(`Linear ACL denied: team ${args.teamId} is not configured for this run.`)
        }
    }
    return { ok: true }
}

export const validateLinearCreateTicketACL: ToolACLValidator<{
    integrationId: string
    ticket: { teamId: string; projectId?: string | null }
}> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyToolACL(`Linear ACL denied: integration ${args.integrationId} is read-only for this run.`)
    }
    if (!hasLinearIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return denyIntegration(args.integrationId)
    }

    const teamRulesExist = linearHasAnyTeamRules({ aclRules, integrationId: args.integrationId })
    if (teamRulesExist && !hasLinearTeamACL({ aclRules, integrationId: args.integrationId, teamId: args.ticket.teamId })) {
        return denyToolACL(`Linear ACL denied: team ${args.ticket.teamId} is not configured for this run.`)
    }

    const projectRulesExist = linearHasAnyProjectRules({ aclRules, integrationId: args.integrationId })
    if (projectRulesExist && args.ticket.projectId) {
        if (!hasLinearProjectACL({ aclRules, integrationId: args.integrationId, projectId: args.ticket.projectId })) {
            return denyToolACL(`Linear ACL denied: project ${args.ticket.projectId} is not configured for this run.`)
        }
    }

    return { ok: true }
}

export const validateLinearUpdateTicketACL: ToolACLValidator<{
    integrationId: string
    updates: { projectId?: string | null }
}> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyToolACL(`Linear ACL denied: integration ${args.integrationId} is read-only for this run.`)
    }
    if (!hasLinearIntegrationACL({ aclRules, integrationId: args.integrationId })) {
        return denyIntegration(args.integrationId)
    }

    const projectRulesExist = linearHasAnyProjectRules({ aclRules, integrationId: args.integrationId })
    if (projectRulesExist && args.updates?.projectId) {
        if (!hasLinearProjectACL({ aclRules, integrationId: args.integrationId, projectId: args.updates.projectId })) {
            return denyToolACL(`Linear ACL denied: project ${args.updates.projectId} is not configured for this run.`)
        }
    }

    return { ok: true }
}

export const validateLinearAddCommentACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs }) => {
    if (!configIsWritableForIntegration({ configs, integrationId: args.integrationId })) {
        return denyToolACL(`Linear ACL denied: integration ${args.integrationId} is read-only for this run.`)
    }
    return hasLinearIntegrationACL({ aclRules, integrationId: args.integrationId }) ? { ok: true } : denyIntegration(args.integrationId)
}
