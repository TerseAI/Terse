import { LinearClient } from "@linear/sdk"
import { RunContext } from "@openai/agents"
import { LinearOutputConfig } from "terse-types"
import { validate as isValidUuid } from "uuid"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { getLinearAccessTokenForOrganization } from "../../integrations/LinearIntegration"
import logger from "../../logger"
import { ToolACLValidationResult, denyToolACL, findConfigsByIntegrationId } from "../abstract/acl"

type LinearIssueScope = { teamId: string | null; projectId: string | null }

type ResolvedLinearIssue = {
    uuid: string
    scope: LinearIssueScope
}

// Cache the validator-resolved UUID so execute() can use it instead of
// re-running searchIssues — see [[Terse-other-toctou-acl-bypass-b6d88728ce]].
// Keyed by RunContext (one per agent step), GC'd with the context.
const resolvedIssueCache = new WeakMap<object, Map<string, ResolvedLinearIssue>>()

function cacheKey(integrationId: string, issueId: string): string {
    return `${integrationId}\0${issueId}`
}

function rememberResolvedIssue(runContext: object | undefined, integrationId: string, issueId: string, resolved: ResolvedLinearIssue): void {
    if (!runContext) return
    let bucket = resolvedIssueCache.get(runContext)
    if (!bucket) {
        bucket = new Map()
        resolvedIssueCache.set(runContext, bucket)
    }
    bucket.set(cacheKey(integrationId, issueId), resolved)
}

/**
 * After validateLinearReadTicket runs, execute() can call this to skip the
 * fuzzy resolution step entirely — closing the TOCTOU window where the
 * validator and execute could resolve to different issues.
 */
export function getResolvedLinearIssue(runContext: object | undefined, integrationId: string, issueId: string): ResolvedLinearIssue | undefined {
    if (!runContext) return undefined
    return resolvedIssueCache.get(runContext)?.get(cacheKey(integrationId, issueId))
}

async function fetchIssueScope(client: LinearClient, issueId: string): Promise<(LinearIssueScope & { uuid: string }) | null> {
    let issue
    if (isValidUuid(issueId)) {
        issue = await client.issue(issueId)
    } else {
        const result = await client.searchIssues(issueId, { first: 1 })
        const first = result.nodes[0]
        issue = first ? await client.issue(first.id) : undefined
    }
    if (!issue) return null
    const team = issue.team ? await issue.team : null
    const project = issue.project ? await issue.project : null
    return { uuid: issue.id, teamId: team?.id ?? null, projectId: project?.id ?? null }
}

function describeConfiguredScopes(configs: LinearOutputConfig[]): string {
    if (configs.length === 0) return "(no configured scope)"
    return configs
        .map(c => {
            const parts: string[] = []
            if (c.teamId) parts.push(`teamId=${c.teamId}`)
            if (c.projectId) parts.push(`projectId=${c.projectId}`)
            return parts.length > 0 ? `{${parts.join(", ")}}` : "{workspace-wide}"
        })
        .join(", ")
}

function scopeMatches(issue: LinearIssueScope, config: LinearOutputConfig): boolean {
    if (config.teamId && issue.teamId !== config.teamId) return false
    if (config.projectId && issue.projectId !== config.projectId) return false
    return true
}

export async function verifyLinearIssueInScope(args: {
    integrationId: string
    issueId: string
    configs: LinearOutputConfig[]
    runContext: RunContext<SessionWithTracking<Session>> | undefined
}): Promise<ToolACLValidationResult> {
    const configsForIntegration = findConfigsByIntegrationId(args.integrationId, args.configs)
    if (configsForIntegration.length === 0) {
        return denyToolACL(`Integration ID "${args.integrationId}" not found.`)
    }
    const narrowing = configsForIntegration.filter(c => c.teamId || c.projectId)
    const organizationId = args.runContext?.context?.user?.organizationId

    if (narrowing.length === 0) {
        // No scope to check, but still resolve once so execute() can reuse the
        // UUID and skip its own searchIssues call.
        if (organizationId) {
            const accessToken = await getLinearAccessTokenForOrganization(args.integrationId, organizationId)
            const client = new LinearClient({ accessToken })
            const resolved = await fetchIssueScope(client, args.issueId)
            if (resolved) {
                rememberResolvedIssue(args.runContext, args.integrationId, args.issueId, {
                    uuid: resolved.uuid,
                    scope: { teamId: resolved.teamId, projectId: resolved.projectId }
                })
            }
        }
        return { ok: true }
    }

    if (!organizationId) return { ok: true } // capability lookup / no runtime context — skip the API hop

    const accessToken = await getLinearAccessTokenForOrganization(args.integrationId, organizationId)
    const client = new LinearClient({ accessToken })
    const resolved = await fetchIssueScope(client, args.issueId)

    if (!resolved) {
        logger.info("[LinearACL] could not resolve issue scope (issue may not exist)", { issueId: args.issueId })
        return denyToolACL(`Linear issue ${args.issueId} could not be found. Configured scope: ${describeConfiguredScopes(configsForIntegration)}.`)
    }
    if (narrowing.some(c => scopeMatches(resolved, c))) {
        rememberResolvedIssue(args.runContext, args.integrationId, args.issueId, {
            uuid: resolved.uuid,
            scope: { teamId: resolved.teamId, projectId: resolved.projectId }
        })
        return { ok: true }
    }

    return denyToolACL(
        `Linear issue ${args.issueId} (team=${resolved.teamId ?? "?"}, project=${resolved.projectId ?? "?"}) is outside the configured scope. ` +
            `Allowed scopes for integration "${args.integrationId}": ${describeConfiguredScopes(narrowing)}.`
    )
}
