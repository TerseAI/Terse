import { searchconsole, searchconsole_v1 } from "@googleapis/searchconsole"
import { OAuth2Client } from "google-auth-library"
import { GoogleSearchConsoleSite, googleSearchConsolePermissionLevelSchema } from "terse-types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

import { GoogleSearchConsoleIntegrationManager } from "./integration"

export async function getSearchConsoleClientForOrganization(integrationId: string, organizationId: string): Promise<SearchConsoleClient> {
    const integration = await db().google_search_console_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId }
    })
    if (!integration) {
        throw new GoogleSearchConsoleAuthError(`Google Search Console integration not found for integrationId: ${integrationId}`)
    }
    return getSearchConsoleClient(integration.id)
}

export async function getSearchConsoleClient(integrationId: string): Promise<SearchConsoleClient> {
    const manager = new GoogleSearchConsoleIntegrationManager()
    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new GoogleSearchConsoleAuthError(`Google Search Console integration ${integrationId} not found or missing access token`)
    }

    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: accessToken })
    return searchconsole({ version: "v1", auth })
}

export async function listSearchConsoleSites(client: SearchConsoleClient): Promise<GoogleSearchConsoleSite[]> {
    const response = await client.sites.list()
    return (response.data.siteEntry ?? []).flatMap(entry => {
        if (!entry.siteUrl) return []
        return [{ siteUrl: entry.siteUrl, permissionLevel: toPermissionLevel(entry.permissionLevel) }]
    })
}

export function toPermissionLevel(permissionLevel: string | null | undefined): GoogleSearchConsoleSite["permissionLevel"] {
    const parsed = googleSearchConsolePermissionLevelSchema.safeParse(permissionLevel)
    if (parsed.success) {
        return parsed.data
    }
    logger.warn("Unrecognized Google Search Console permission level, treating the property as unverified", { permissionLevel })
    return "siteUnverifiedUser"
}

export type SearchConsoleClient = searchconsole_v1.Searchconsole

export class GoogleSearchConsoleAuthError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "GoogleSearchConsoleAuthError"
    }
}
