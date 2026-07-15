import type { GithubIntegration, ToolDefinition } from "terse-types"
import { ApiRoutes, IntegrationType } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput, type ToolFileContext } from "../IntegrationModule.js"
import { buildSkillToolType, toGeneratedIdentifier } from "../moduleHelpers.js"

export class GithubModule extends IntegrationModule<GitHubInstanceData, GitHubSectionContext> {
    readonly type = IntegrationType.GITHUB
    readonly summaryLabel = "GitHub"
    protected readonly sectionImports = ["GitHubConfig", "GitHubEventType", "TypedTrigger", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<GitHubInstanceData[]> {
        const instances = await fetchWithAuth<GithubIntegration[]>(ApiRoutes.GITHUB.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<GitHubInstanceData> => {
                const data = await fetchWithAuth<{ repositories: Array<{ id: number; name: string; owner: string }> }>(
                    `${ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION}?installation_id=${encodeURIComponent(inst.installation_id)}`,
                    apiKey
                ).catch(() => ({ repositories: [] }))
                return { integration: inst, repositories: data.repositories || [] }
            })
        )
    }

    instanceId(instance: GitHubInstanceData): string {
        return instance.integration.id
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    github: githubTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** GitHub — read code and pull requests from the given repositories */", "    github: githubSkill,"]
    }

    protected prepareSection(input: ModuleRenderInput<GitHubInstanceData>): GitHubSectionContext {
        const inst = this.requireInstance(input)
        const skillToolType = buildSkillToolType(input.tools)

        const repositoriesWithFullName = inst.repositories.map(repo => {
            const owner = repo.owner || "UnknownOwner"
            const fullName = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name
            return { ...repo, owner, fullName }
        })

        const ownerEntries = new Map<string, { staticName: string; repos: typeof repositoriesWithFullName }>()
        const usedOwnerNames = new Set<string>()
        for (const repo of repositoriesWithFullName) {
            if (!ownerEntries.has(repo.owner)) {
                let ownerStaticName = toGeneratedIdentifier(repo.owner, "UnknownOwner")
                while (usedOwnerNames.has(ownerStaticName)) ownerStaticName += "_"
                usedOwnerNames.add(ownerStaticName)
                ownerEntries.set(repo.owner, { staticName: ownerStaticName, repos: [] as typeof repositoriesWithFullName })
            }
            ownerEntries.get(repo.owner)!.repos.push(repo)
        }

        const owners = Array.from(ownerEntries.entries()).map(([name, data]) => ({
            name,
            staticName: data.staticName
        }))

        const repoGroups = Array.from(ownerEntries.values()).map(group => {
            const usedRepoNames = new Set<string>()
            return {
                ownerStaticName: group.staticName,
                repos: group.repos.map(repo => {
                    let staticName = toGeneratedIdentifier(repo.name, "Repos")
                    while (usedRepoNames.has(staticName)) staticName += "_"
                    usedRepoNames.add(staticName)
                    return {
                        id: repo.id,
                        name: repo.name,
                        fullName: repo.fullName,
                        staticName
                    }
                })
            }
        })

        return {
            id: inst.integration.id,
            skillToolType,
            owners,
            repoGroups
        }
    }

    protected normalizeParamsExpression(tool: ToolDefinition): string {
        switch (tool.name) {
            case "readGitHubFile":
            case "listGitHubPullRequests":
            case "listGitHubDirectory":
            case "listGitHubCommits":
            case "summarizeGitHubPullRequestDiff":
                return "{ ...params, repository: __normalizeGitHubRepos((params).repository) }"
            case "searchGitHubCode":
            case "grepGitHubCode":
                return "{ ...params, repositoryNames: __normalizeGitHubReposNames((params).repositoryNames) }"
            default:
                return "params"
        }
    }

    protected extraTemplateContext(input: ModuleRenderInput<GitHubInstanceData>, toolFile: ToolFileContext | undefined): Record<string, unknown> {
        return { repoMappings: toolFile ? buildRepoMappings(input.instances) : [] }
    }
}

function buildRepoMappings(instances: readonly GitHubInstanceData[]): Array<{ name: string; fullName: string }> {
    const githubRepoFullNames = Array.from(
        new Set(instances.flatMap(inst => inst.repositories.map(repo => (repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name).trim()).filter(Boolean)))
    )

    const nameToFullName = new Map<string, string>()
    const ambiguousNames = new Set<string>()
    for (const fullName of githubRepoFullNames) {
        const [, repoName = fullName] = fullName.split("/", 2)
        if (nameToFullName.has(repoName) && nameToFullName.get(repoName) !== fullName) {
            ambiguousNames.add(repoName)
            nameToFullName.delete(repoName)
        } else if (!ambiguousNames.has(repoName)) {
            nameToFullName.set(repoName, fullName)
        }
    }

    return Array.from(nameToFullName.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, fullName]) => ({ name, fullName }))
}

interface GitHubRepo {
    id: number
    name: string
    owner: string
    fullName?: string
}

export interface GitHubInstanceData {
    integration: GithubIntegration
    repositories: GitHubRepo[]
}

export interface GitHubSectionContext {
    id: string
    skillToolType: string
    owners: Array<{ name: string; staticName: string }>
    repoGroups: Array<{
        ownerStaticName: string
        repos: Array<{
            id: number
            name: string
            fullName: string
            staticName: string
        }>
    }>
}
