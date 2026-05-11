import { type Organization, type User, WorkOS } from "@workos-inc/node"
import { IntegrationType } from "terse-types"
import { User as TerseUser } from "terse-types"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { SecretField, getSecret } from "../../services/SecretService"

/**
 * Get the WorkOS API key for a given integration, validating that
 * the integration belongs to the user's organization.
 */
export async function getWorkOSApiKeyByIntegrationId(integrationId: string, user: TerseUser): Promise<string | null> {
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

    return await getSecret(IntegrationType.WORKOS, integration.id, SecretField.ApiKey)
}

function workosForApiKey(apiKey: string): WorkOS {
    return new WorkOS({ apiKey })
}

export type WorkOSUsersListPage = {
    data: User[]
    listMetadata: { after: string | null; before: string | null }
}

export type WorkOSOrganizationsListPage = {
    data: Organization[]
    listMetadata: { after: string | null; before: string | null }
}

/**
 * List users from the customer's WorkOS account using their API key.
 */
export async function listWorkOSUsers(apiKey: string, options: { limit?: number; after?: string; before?: string; email?: string; organizationId?: string } = {}): Promise<WorkOSUsersListPage> {
    const workos = workosForApiKey(apiKey)
    const page = await workos.userManagement.listUsers({
        limit: options.limit !== undefined ? Math.min(options.limit, 100) : undefined,
        after: options.after ?? undefined,
        before: options.before ?? undefined,
        email: options.email,
        organizationId: options.organizationId
    })

    return {
        data: page.data,
        listMetadata: {
            after: page.listMetadata.after ?? null,
            before: page.listMetadata.before ?? null
        }
    }
}

/**
 * List organizations from the customer's WorkOS account using their API key.
 */
export async function listWorkOSOrganizations(apiKey: string, options: { limit?: number; after?: string; before?: string } = {}): Promise<WorkOSOrganizationsListPage> {
    const workos = workosForApiKey(apiKey)
    const page = await workos.organizations.listOrganizations({
        limit: options.limit !== undefined ? Math.min(options.limit, 100) : undefined,
        after: options.after ?? undefined,
        before: options.before ?? undefined
    })

    return {
        data: page.data,
        listMetadata: {
            after: page.listMetadata.after ?? null,
            before: page.listMetadata.before ?? null
        }
    }
}

/**
 * Get a single user by ID from the customer's WorkOS account.
 */
export async function getWorkOSUser(apiKey: string, userId: string): Promise<User> {
    const workos = workosForApiKey(apiKey)
    return workos.userManagement.getUser(userId)
}
