import type { ACLRule, ConfigData, GitHubConfigData, GitHubSkillConfigData } from "terse-types"
import { ConfigType, IntegrationType } from "terse-types"

import { createGitHubClient, getGitHubAccessToken, getRepositoryNamesByIds } from "../../outputs/github/githubApiClient"

export type HydrateACLRulesOptions = {
    /** Required for GitHub repository ID → full name resolution. */
    userId?: string
}

function isGitHubConfigWithRepositories(config: ConfigData): config is GitHubConfigData | GitHubSkillConfigData {
    if (config.configType !== ConfigType.GITHUB) return false
    const gh = config as GitHubConfigData | GitHubSkillConfigData
    return Array.isArray(gh.repositoryIds) && gh.repositoryIds.length > 0
}

async function getGitHubHydratedACLRules(configs: ConfigData[], options?: HydrateACLRulesOptions): Promise<ACLRule[]> {
    if (!options?.userId) {
        return []
    }

    const accessToken = await getGitHubAccessToken(options.userId)
    if (!accessToken) {
        return []
    }

    const githubConfigs = configs.filter(isGitHubConfigWithRepositories)
    if (githubConfigs.length === 0) {
        return []
    }

    const client = createGitHubClient(accessToken)
    const rules: ACLRule[] = []

    for (const config of githubConfigs) {
        const repoIds = config.repositoryIds ?? []
        const nameById = await getRepositoryNamesByIds(client, repoIds)
        for (const repoId of repoIds) {
            const fullName = nameById.get(repoId)
            if (!fullName) continue
            rules.push({
                integrationType: IntegrationType.GITHUB,
                integrationId: config.integrationId,
                resourceType: "repository",
                resourceId: fullName.trim().toLowerCase()
            })
        }
    }

    return rules
}

/**
 * Backend-only async ACL hydration (e.g. GitHub repository IDs → owner/repo names).
 * Does not replace terse-types `getMergedACLRules`; merged with it in `buildRunACLRules`.
 */
export async function getHydratedACLRules(configs: ConfigData[], options?: HydrateACLRulesOptions): Promise<ACLRule[]> {
    const rules: ACLRule[] = []

    rules.push(...(await getGitHubHydratedACLRules(configs, options)))

    return rules
}
