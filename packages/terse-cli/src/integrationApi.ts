import { pollUntil } from "terse-sdk"
import {
    ApiRoutes,
    ConfigurationFieldDefinition,
    FormFieldDefinition,
    IntegrationConnection,
    IntegrationConnectionsResponseSchema,
    IntegrationFieldsResponse,
    IntegrationType,
    IntegrationWithStatus,
    OAuthInstallationDetails,
    buildRoute
} from "terse-types"

import { ApiError, fetchWithAuth } from "./api.js"
import { CliError } from "./cliError.js"

export type { IntegrationFieldsResponse, FormFieldDefinition, ConfigurationFieldDefinition }

export async function fetchIntegrations(apiKey: string): Promise<IntegrationWithStatus[]> {
    return fetchWithAuth<IntegrationWithStatus[]>(ApiRoutes.INTEGRATIONS.LIST, apiKey)
}

export async function fetchIntegrationConnections(apiKey: string, integrationType: string): Promise<IntegrationConnection[]> {
    let raw: unknown
    try {
        raw = await fetchWithAuth<unknown>(buildRoute(ApiRoutes.INTEGRATIONS.CONNECTIONS_BY_TYPE, { integrationType }), apiKey)
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
            throw new CliError("integration_connections_unavailable", `Could not list connections for '${integrationType}'.`, {
                detail: "The backend does not recognize this integration type."
            })
        }
        throw err
    }

    const parsed = IntegrationConnectionsResponseSchema.safeParse(raw)
    if (!parsed.success) {
        throw new CliError("integration_connections_malformed", `The connections returned for '${integrationType}' did not match the expected shape.`, {
            detail: parsed.error.message
        })
    }
    return parsed.data.connections
}

export async function fetchIntegrationFields(apiKey: string, integrationType: string): Promise<IntegrationFieldsResponse> {
    return fetchWithAuth<IntegrationFieldsResponse>(buildRoute(ApiRoutes.SDK.INTEGRATION_FIELDS, { integrationType }), apiKey)
}

export async function submitIntegrationForm(apiKey: string, integrationType: string, formValues: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return fetchWithAuth<{ success: boolean; error?: string }>(buildRoute(ApiRoutes.SDK.INTEGRATION_FORM_SUBMIT, { integrationType }), apiKey, { formValues }, "POST")
}

export async function fetchInstallationUrl(apiKey: string, integrationType: string, options?: Record<string, unknown>): Promise<OAuthInstallationDetails> {
    const optionsParam = options ? `?options=${encodeURIComponent(JSON.stringify(options))}` : ""
    return fetchWithAuth<OAuthInstallationDetails>(`${buildRoute(ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE, { integrationType })}${optionsParam}`, apiKey)
}

export async function disconnectIntegration(apiKey: string, integrationType: IntegrationType): Promise<{ success: boolean; error?: string }> {
    return fetchWithAuth<{ success: boolean; error?: string }>(buildRoute(ApiRoutes.INTEGRATIONS.DISCONNECT_BY_TYPE, { integrationType }), apiKey, {}, "DELETE")
}

export async function pollForConnection(apiKey: string, integrationType: string, timeoutMs = 120_000, intervalMs = 3_000): Promise<boolean> {
    const connected = await pollUntil(
        async () => {
            const integrations = await fetchIntegrations(apiKey)
            const match = integrations.find(i => i.integrationType === integrationType)
            return match?.isActive ? true : undefined
        },
        { intervalMs, timeoutMs }
    )
    return connected ?? false
}
