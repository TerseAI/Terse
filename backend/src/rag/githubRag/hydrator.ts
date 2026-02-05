import { Octokit } from "@octokit/rest"

import { getAppInstallationsForUser } from "../../integrations/GithubIntegration"
import { GithubEvent } from "../../integrations/GithubIntegration"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import type { GithubAppUnifiedEventRequest } from "../../routes/GithubTypes"
import { IntegrationType } from "../../shared/Integrations"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class GithubEventHydrator extends Hydrator<GithubEvent> {
    readonly entityType = HydratorType.GITHUB_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<GithubEvent> {
        const event = await this.fetchFromGitHub(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate GitHub event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<GithubEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromGitHub(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate GitHub event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromGitHub(entityId: string): Promise<GithubEvent | null> {
        const parts = entityId.split(":")
        if (parts.length < 3) {
            logger.error(`Invalid GitHub entityId format: ${entityId}`)
            return null
        }
        const [installationIdStr, repoIdStr, typeAndId] = parts
        const installationId = parseInt(installationIdStr, 10)
        const repoId = parseInt(repoIdStr, 10)
        if (isNaN(installationId) || isNaN(repoId)) {
            logger.error(`Invalid GitHub entityId (installationId or repoId not numeric): ${entityId}`)
            return null
        }
        const [type, identifier] = typeAndId.split("/")
        if (!type || !identifier) {
            logger.error(`Invalid GitHub entityId (type/identifier): ${entityId}`)
            return null
        }

        const githubToken = await db().github_app_tokens.findFirst({
            where: this.ctx.organizationId ? { organization_id: this.ctx.organizationId } : undefined
        })
        if (!githubToken?.access_token) {
            logger.error("No GitHub OAuth token found for user org")
            return null
        }

        const installations = await getAppInstallationsForUser(githubToken.access_token)
        const installation = installations.installations?.find((inst: { id: number }) => inst.id === installationId)
        if (!installation) {
            logger.error(`Installation ${installationId} not found for user`)
            return null
        }

        const octokit = new Octokit({ auth: githubToken.access_token })

        try {
            const { data: repo } = await octokit.request("GET /repositories/{repo_id}", { repo_id: repoId })
            const [owner, name] = repo.full_name.split("/")
            if (!owner || !name) {
                return null
            }

            if (type === "pr") {
                const prNumber = parseInt(identifier, 10)
                const { data: pr } = await octokit.pulls.get({ owner, repo: name, pull_number: prNumber })
                const eventData: GithubAppUnifiedEventRequest = {
                    username: pr.user?.login ?? "",
                    installationId,
                    repositoryName: repo.full_name,
                    eventType: pr.state === "closed" ? "pull_request.closed" : "pull_request.opened",
                    repository: {
                        id: repo.id,
                        name: repo.name,
                        owner: repo.owner?.login ?? owner,
                        defaultBranch: repo.default_branch ?? "main"
                    },
                    sender: {
                        login: pr.user?.login ?? "",
                        email: (pr.user as any)?.email
                    },
                    commits: [],
                    pullRequest: {
                        id: String(pr.id),
                        number: pr.number,
                        title: pr.title ?? "",
                        body: pr.body ?? undefined,
                        state: pr.state === "closed" ? "closed" : "open",
                        merged: !!pr.merged,
                        head: { ref: pr.head.ref, sha: pr.head.sha },
                        base: { ref: pr.base.ref, sha: pr.base.sha },
                        user: { login: pr.user?.login ?? "", email: (pr.user as any)?.email }
                    }
                }
                return new GithubEvent(eventData, [])
            }

            if (type === "commit") {
                const { data: commit } = await octokit.repos.getCommit({ owner, repo: name, ref: identifier })
                const eventData: GithubAppUnifiedEventRequest = {
                    username: commit.commit?.author?.name ?? "",
                    installationId,
                    repositoryName: repo.full_name,
                    eventType: "push",
                    branch: repo.default_branch ?? "main",
                    repository: {
                        id: repo.id,
                        name: repo.name,
                        owner: repo.owner?.login ?? owner,
                        defaultBranch: repo.default_branch ?? "main"
                    },
                    sender: {
                        login: commit.author?.login ?? commit.commit?.author?.name ?? "",
                        email: commit.commit?.author?.email
                    },
                    commits: [
                        {
                            sha: commit.sha,
                            name: commit.commit?.message?.split("\n")[0] ?? "",
                            fileDiffs: []
                        }
                    ]
                }
                return new GithubEvent(eventData, [])
            }

            logger.warn(`Unsupported GitHub entity type: ${type}`)
            return null
        } catch (error) {
            logger.error(`Failed to fetch GitHub event ${entityId}`, { error })
            return null
        }
    }
}
