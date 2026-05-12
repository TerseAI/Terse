import { LinearClient } from "@linear/sdk"
import { RunContext } from "@openai/agents"
import { LinearOutputConfig } from "terse-types"
import { validate as isValidUuid } from "uuid"

import { SessionWithTracking } from "../../agent/AgentRunner/AgentRunner"
import { Session } from "../../express"
import { getLinearAccessTokenForOrganization } from "../../integrations/LinearIntegration"
import logger from "../../logger"
import { ToolACLValidationResult, denyToolACL, findConfigsByIntegrationId } from "../abstract/Output"

type LinearIssueScope = { teamId: string | null; projectId: string | null }

const issueScopeCache = new WeakMap<object, Map<string, Promise<LinearIssueScope | null>>>()

function cacheFor(runContext: RunContext<SessionWithTracking<Session>> | undefined): Map<string, Promise<LinearIssueScope | null>> | null {
    const ctx = runContext?.context as unknown as object | undefined
    if (!ctx) return null
    let m = issueScopeCache.get(ctx)
    if (!m) {
        m = new Map()
        issueScopeCache.set(ctx, m)
    }
    return m
}

async function fetchIssueScope(client: LinearClient, issueId: string): Promise<LinearIssueScope | null> {
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
    return { teamId: team?.id ?? null, projectId: project?.id ?? null }
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

/**
 * Verify that the issue identified by `issueId` lives within at least one of the configured (team, project) scopes
 * for any config sharing `integrationId`. Returns ok if no config narrows scope. Fetches the issue once per run.
 */
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
    if (narrowing.length === 0) return { ok: true }

    const organizationId = args.runContext?.context?.user?.organizationId
    if (!organizationId) return { ok: true } // capability lookup / no runtime context — skip the API hop

    const cache = cacheFor(args.runContext)
    const cacheKey = `${args.integrationId}:${args.issueId}`
    let scopePromise: Promise<LinearIssueScope | null>
    if (cache?.has(cacheKey)) {
        scopePromise = cache.get(cacheKey)!
    } else {
        scopePromise = (async () => {
            const accessToken = await getLinearAccessTokenForOrganization(args.integrationId, organizationId)
            const client = new LinearClient({ accessToken })
            return fetchIssueScope(client, args.issueId)
        })()
        cache?.set(cacheKey, scopePromise)
    }

    const issueScope = await scopePromise
    if (!issueScope) {
        logger.info("[LinearACL] could not resolve issue scope (issue may not exist)", { issueId: args.issueId })
        return denyToolACL(`Linear issue ${args.issueId} could not be found. Configured scope: ${describeConfiguredScopes(configsForIntegration)}.`)
    }
    if (narrowing.some(c => scopeMatches(issueScope, c))) return { ok: true }

    return denyToolACL(
        `Linear issue ${args.issueId} (team=${issueScope.teamId ?? "?"}, project=${issueScope.projectId ?? "?"}) is outside the configured scope. ` +
            `Allowed scopes for integration "${args.integrationId}": ${describeConfiguredScopes(narrowing)}.`
    )
}
