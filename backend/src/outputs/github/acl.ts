import { ACLRule, IntegrationType } from "terse-types"

import { ToolACLValidator } from "../abstract/Output"

export function normalizeGitHubRepositoryResourceId(repository: string): string {
    return repository.trim().toLowerCase()
}

function isGitHubRepositoryAllowed(rules: ACLRule[], repository: string): boolean {
    const resourceId = normalizeGitHubRepositoryResourceId(repository)
    return rules.some(rule => rule.integrationType === IntegrationType.GITHUB && rule.resourceType === "repository" && rule.resourceId === resourceId)
}

export const validateGitHubRepositoryACL: ToolACLValidator<{ repository: string }> = ({ args, aclRules }) => {
    if (isGitHubRepositoryAllowed(aclRules, args.repository)) {
        return { ok: true }
    }
    return {
        ok: false,
        message: `GitHub ACL denied: repository ${args.repository} is not configured for this run.`
    }
}

export const validateGitHubRepositoriesACL: ToolACLValidator<{ repositoryNames: string[] }> = ({ args, aclRules }) => {
    const denied = (args.repositoryNames ?? []).filter(repository => !isGitHubRepositoryAllowed(aclRules, repository))
    if (denied.length === 0) {
        return { ok: true }
    }
    return {
        ok: false,
        message: `GitHub ACL denied: repositories not configured for this run: ${denied.join(", ")}.`
    }
}
