import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { Integration } from '@/types/Integration';
import { INTEGRATION_KEY_MAP } from '@/utility/IntegrationUtils';
import type { IntegrationsStatus } from '@/shared/types';

export type IntegrationMetadata = {
    type: IntegrationType;
    integrationId: string;
}

const integrationsKey = (): readonly [string] => ['integrations'];

function transformToIntegrationMetadata(integrationData: IntegrationTypesStatus['integrations']): IntegrationTypeMetadata[] {
    const activeIntegrations: IntegrationTypeMetadata[] = [];

    for (const [integrationType, key] of Object.entries(INTEGRATION_KEY_MAP)) {
        const instances = integrationData[key];
        if (instances && instances.length > 0) {
            activeIntegrations.push({
                type: IntegrationTypeType as Integration,
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
    const hasGithub = integrations.some(integration => IntegrationType.type === IntegrationType.GITHUB);
    const hasLinear = integrations.some(integration => IntegrationType.type === IntegrationType.LINEAR);
    const hasJira = integrations.some(integration => IntegrationType.type === IntegrationType.JIRA);
    const hasSlack = integrations.some(integration => IntegrationType.type === IntegrationType.SLACK);
    const hasGmail = integrations.some(integration => IntegrationType.type === IntegrationType.GMAIL);
    const hasNotion = integrations.some(integration => IntegrationType.type === IntegrationType.NOTION);
    const isSetupComplete = hasGithub && (hasLinear || hasJira || hasNotion);
    
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
