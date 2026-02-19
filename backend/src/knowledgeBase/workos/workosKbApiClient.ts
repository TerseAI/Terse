import logger from "../../logger"
import { db } from "../../prismaClient"
import { User } from "../../shared/types"

/**
 * Get the WorkOS API key for a given integration, validating that
 * the integration belongs to the user's organization.
 */
export async function getWorkOSApiKeyByIntegrationId(integrationId: string, user: User): Promise<string | null> {
    const integration = await db().workos_integrations.findUnique({
        where: { id: integrationId }
    })

    if (!integration) {
        logger.warn("WorkOS integration not found", { integrationId, organizationId: user.organizationId })
        return null
    }

    if (integration.organization_id !== user.organizationId) {
        logger.warn("WorkOS integration does not belong to user's organization", { integrationId, organizationId: user.organizationId, tokenOrganizationId: integration.organization_id })
        return null
    }

    return integration.api_key
}

export interface WorkOSUserResponse {
    id: string
    email: string
    email_verified: boolean
    first_name: string | null
    last_name: string | null
    profile_picture_url: string | null
    created_at: string
    updated_at: string
}

export interface WorkOSListUsersResponse {
    data: WorkOSUserResponse[]
    list_metadata: {
        after: string | null
        before: string | null
    }
}

/**
 * List users from the customer's WorkOS account using their API key.
 */
export async function listWorkOSUsers(
    apiKey: string,
    options: { limit?: number; after?: string; before?: string; email?: string; organizationId?: string } = {}
): Promise<WorkOSListUsersResponse> {
    const params = new URLSearchParams()
    if (options.limit) params.set("limit", String(Math.min(options.limit, 100)))
    if (options.after) params.set("after", options.after)
    if (options.before) params.set("before", options.before)
    if (options.email) params.set("email", options.email)
    if (options.organizationId) params.set("organization_id", options.organizationId)

    const response = await fetch(`https://api.workos.com/user_management/users?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error("Failed to list WorkOS users", { status: response.status, error: errorText })
        throw new Error(`WorkOS users API returned ${response.status}: ${errorText}`)
    }

    return (await response.json()) as WorkOSListUsersResponse
}

/**
 * Get a single user by ID from the customer's WorkOS account.
 */
export async function getWorkOSUser(apiKey: string, userId: string): Promise<WorkOSUserResponse> {
    const response = await fetch(`https://api.workos.com/user_management/users/${userId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error("Failed to get WorkOS user", { status: response.status, error: errorText, userId })
        throw new Error(`WorkOS user API returned ${response.status}: ${errorText}`)
    }

    return (await response.json()) as WorkOSUserResponse
}
