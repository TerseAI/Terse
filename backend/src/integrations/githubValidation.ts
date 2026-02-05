import { db } from "../prismaClient"

import { getAppInstallationRepositories, getAppInstallationsForUser } from "./GithubIntegration"

type GithubValidationOptions = {
    userId: string
    integrationId: string
    repositoryIds: number[]
    configTypeLabel: string
    contextLabel: string
}

export async function validateGithubRepositoryIds({ userId, integrationId, repositoryIds, configTypeLabel, contextLabel }: GithubValidationOptions): Promise<void> {
    if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: requires at least one repository`)
    }

    if (!userId) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: userId is required for validation`)
    }

    const accessToken = await db().github_app_tokens.findFirst({
        where: { user_id: userId },
        select: { access_token: true }
    })

    if (!accessToken?.access_token) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: no GitHub access token found for user`)
    }

    const terseInstallation = await db().user_github_installation.findUnique({
        where: { id: integrationId },
        select: { installation_id: true }
    })
    if (!terseInstallation) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: integration not found`)
    }
    const githubInstallationId = terseInstallation.installation_id

    const installations = await getAppInstallationsForUser(accessToken.access_token)
    const targetInstallation = installations.installations.find(installation => installation.id === githubInstallationId)

    if (!targetInstallation) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: installation not found`)
    }

    const repositories = await getAppInstallationRepositories(accessToken.access_token, targetInstallation.id)

    const foundIds = new Set(repositories.map(repo => repo.id))
    const missingIds = repositoryIds.filter(id => !foundIds.has(id))
    if (missingIds.length > 0) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: repositories not found (${missingIds.join(", ")})`)
    }
}
