import { apiTokensKey } from "terse-types/InvalidationKeys"
import { ApiToken } from "terse-types/types"

import { emitCacheInvalidationWithKey } from "../../services/CacheInvalidationService"
import { createApiToken as createTokenInDb, getApiTokensForUser } from "../../utility/apiTokens"
import { FeatureFlag, FeatureFlagService } from "../../utility/featureFlags"

import { deleteApiTokenById, findUserApiToken, updateApiTokenName } from "./repository"

const API_TOKENS_INVALIDATION_KEY = apiTokensKey()[0]
const featureFlagService = FeatureFlagService.getInstance()

export class ApiTokenNotFoundError extends Error {
    constructor() {
        super("API token not found")
        this.name = "ApiTokenNotFoundError"
    }
}

export class SdkInterfaceDisabledError extends Error {
    constructor() {
        super("SDK interface is not enabled for your account")
        this.name = "SdkInterfaceDisabledError"
    }
}

export async function assertSdkInterfaceEnabled(userEmail: string): Promise<void> {
    const enabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, userEmail, { email: userEmail })
    if (!enabled) throw new SdkInterfaceDisabledError()
}

function invalidateApiTokens(organizationId: string | null | undefined): void {
    if (!organizationId) return
    emitCacheInvalidationWithKey(organizationId, API_TOKENS_INVALIDATION_KEY)
}

export async function listApiTokensForUser(userId: string, organizationId: string) {
    return getApiTokensForUser(userId, organizationId)
}

export async function createApiTokenForUser(userId: string, organizationId: string, name: string) {
    const response = await createTokenInDb(userId, organizationId, name)
    invalidateApiTokens(organizationId)
    return response
}

export async function updateApiTokenForUser(tokenId: string, userId: string, organizationId: string, name: string): Promise<ApiToken> {
    const existing = await findUserApiToken(tokenId, userId, organizationId)
    if (!existing) throw new ApiTokenNotFoundError()

    const updated = await updateApiTokenName(tokenId, name.trim())
    invalidateApiTokens(organizationId)

    return {
        id: updated.id,
        name: updated.name,
        tokenPrefix: updated.token_prefix,
        createdAt: updated.created_at.toISOString(),
        lastUsedAt: updated.last_used_at?.toISOString() ?? null
    }
}

export async function deleteApiTokenForUser(tokenId: string, userId: string, organizationId: string): Promise<void> {
    const existing = await findUserApiToken(tokenId, userId, organizationId)
    if (!existing) throw new ApiTokenNotFoundError()
    await deleteApiTokenById(tokenId)
    invalidateApiTokens(organizationId)
}
