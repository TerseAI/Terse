import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { BackendProvider } from '../services/backend';

export enum Integration {
    JIRA = 'jira',
    LINEAR = 'linear',
    SLACK = 'slack',
    GITHUB = 'github',
}

type IntegrationContextType = {
    integrations: Integration[];
    isLoading: boolean;
    refreshIntegrations: () => Promise<void>;
    hasGithub: boolean;
    hasLinear: boolean;
    hasJira: boolean;
    hasSlack: boolean;
    isSetupComplete: boolean;
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: ReactNode }) {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshIntegrations = async () => {
        try {
            const { integrations: integrationData } = await BackendProvider.getIntegrationsStatus();
            const activeIntegrations: Integration[] = [];
            
            if (integrationData.github) {
                activeIntegrations.push(Integration.GITHUB);
            }
            if (integrationData.linear) {
                activeIntegrations.push(Integration.LINEAR);
            }
            if (integrationData.jira) {
                activeIntegrations.push(Integration.JIRA);
            }
            if (integrationData.slack) {
                activeIntegrations.push(Integration.SLACK);
            }
            
            setIntegrations(activeIntegrations);
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setIntegrations([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshIntegrations();
    }, []);

    // Compute integration status
    const hasGithub = integrations.includes(Integration.GITHUB);
    const hasLinear = integrations.includes(Integration.LINEAR);
    const hasJira = integrations.includes(Integration.JIRA);
    const hasSlack = integrations.includes(Integration.SLACK);
    const isSetupComplete = hasGithub && (hasLinear || hasJira);

    return (
        <IntegrationContext.Provider value={{ 
            integrations, 
            isLoading, 
            refreshIntegrations,
            hasGithub,
            hasLinear,
            hasJira,
            hasSlack,
            isSetupComplete
        }}>
            {children}
        </IntegrationContext.Provider>
    );  
}

export function useIntegrations() {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error('useIntegrations must be used within a IntegrationProvider');
    }
    return context;
}