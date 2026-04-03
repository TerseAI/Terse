import { IntegrationWithStatus } from "terse-types"
import { ConfigurationFieldDefinition, FormFieldDefinition, IntegrationFieldsResponse, OAuthInstallationDetails } from "terse-types"

import { fetchWithAuth } from "./api.js"

export type { IntegrationFieldsResponse, FormFieldDefinition, ConfigurationFieldDefinition }

export async function fetchIntegrations(apiKey: string): Promise<IntegrationWithStatus[]> {
    return fetchWithAuth<IntegrationWithStatus[]>("/integrations", apiKey)
}

export async function fetchIntegrationFields(apiKey: string, integrationType: string): Promise<IntegrationFieldsResponse> {
    return fetchWithAuth<IntegrationFieldsResponse>(`/sdk/integrations/${integrationType}/fields`, apiKey)
}

export async function submitIntegrationForm(apiKey: string, integrationType: string, formValues: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    return fetchWithAuth<{ success: boolean; error?: string }>(`/sdk/integrations/${integrationType}/form-submit`, apiKey, { formValues }, "POST")
}

export async function fetchInstallationUrl(apiKey: string, integrationType: string, options?: Record<string, string>): Promise<OAuthInstallationDetails> {
    const optionsParam = options ? `?options=${encodeURIComponent(JSON.stringify(options))}` : ""
    return fetchWithAuth<OAuthInstallationDetails>(`/integrations/${integrationType}/installation-details${optionsParam}`, apiKey)
}

export async function pollForConnection(apiKey: string, integrationType: string, timeoutMs = 120_000, intervalMs = 3_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        try {
            const integrations = await fetchIntegrations(apiKey)
            const match = integrations.find(i => i.integrationType === integrationType)
            if (match?.isActive) return true
        } catch {
            // ignore transient errors, keep polling
        }
    }

    return false
}
