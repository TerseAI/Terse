import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { Integration } from '@/types/Integration';
import { INTEGRATION_KEY_MAP } from '@/utility/IntegrationUtils';
import type { IntegrationsStatus } from '@/shared/types';

export type IntegrationMetadata = {
    type: Integration;
    integrationId: string;
}

const integrationsKey = (): readonly [string] => ['integrations'];

function transformToIntegrationMetadata(integrationData: IntegrationsStatus['integrations']): IntegrationMetadata[] {
    const activeIntegrations: IntegrationMetadata[] = [];

    for (const [integrationType, key] of Object.entries(INTEGRATION_KEY_MAP)) {
        const instances = integrationData[key];
        if (instances && instances.length > 0) {
            activeIntegrations.push({
                type: integrationType as Integration,
                integrationId: instances[0].id
            });
        }
    }

    return activeIntegrations;
}

export function useIntegrations() {
    const key = integrationsKey();

    const { data, error, isValidating, mutate } = useSWR<IntegrationsStatus>(
        key,
        async () => {
            return BackendProvider.getIntegrationsStatus();
        }
    );

    const integrations = data ? transformToIntegrationMetadata(data.integrations) : [];
    const isLoading = !data && !error;

    // Compute integration status flags
    const hasGithub = integrations.some(integration => integration.type === Integration.GITHUB);
    const hasLinear = integrations.some(integration => integration.type === Integration.LINEAR);
    const hasJira = integrations.some(integration => integration.type === Integration.JIRA);
    const hasSlack = integrations.some(integration => integration.type === Integration.SLACK);
    const hasGmail = integrations.some(integration => integration.type === Integration.GMAIL);
    const hasNotion = integrations.some(integration => integration.type === Integration.NOTION);
    const isSetupComplete = hasGithub && (hasLinear || hasJira || hasNotion);
    
    console.log("Integrations:", JSON.stringify(integrations, null, 2));

    return {
        integrations,
        integrationStatus: data,
        isLoading,
        isError: error,
        isValidating,
        mutate,
        hasGithub,
        hasLinear,
        hasJira,
        hasSlack,
        hasGmail,
        hasNotion,
        isSetupComplete,
    };
}
