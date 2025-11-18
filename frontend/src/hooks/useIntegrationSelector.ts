import { isInputComplete } from '../utility/IntegrationUtils';
import { IntegrationSelectorProps } from '../components/IntegrationSelector/types';

export function useIntegrationSelector(props: IntegrationSelectorProps) {
    // Check if configuration is incomplete
    const isConfigurationIncomplete = () => {
        const input = {
            integration: props.integrationType,
            integrationId: props.selectedIntegrationId,
            notionConfig: props.notionConfig,
            notionPageConfig: props.notionPageConfig,
            slackConfig: props.slackConfig,
            figmaConfig: props.figmaConfig,
            gmailConfig: props.gmailConfig,
            confluenceConfig: props.confluenceConfig,
        };
        return !isInputComplete(input);
    };

    return {
        isConfigurationIncomplete,
    };
}
