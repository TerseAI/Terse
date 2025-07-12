import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { BackendProvider } from '../services/backend';
import posthog from 'posthog-js';
import { PosthogEvents } from '../utility/PosthogEvents';
import { useAuth } from '../services/auth';

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
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: ReactNode }) {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    const refreshIntegrations = async () => {
        try {
            const { integrations: integrationData } = await BackendProvider.getIntegrationsStatus();
            const activeIntegrations: Integration[] = [];
            
            if (integrationData.github) {
                posthog.capture(PosthogEvents.USER_INTEGRATED_GITHUB, {
                    email: user?.email || 'unknown',
                }); 
                activeIntegrations.push(Integration.GITHUB);
            }
            if (integrationData.linear) {
                posthog.capture(PosthogEvents.USER_INTEGRATED_LINEAR, {
                    email: user?.email || 'unknown',
                });
                activeIntegrations.push(Integration.LINEAR);
            }
            if (integrationData.jira) {
                posthog.capture(PosthogEvents.USER_INTEGRATED_JIRA, {
                    email: user?.email || 'unknown',
                });
                activeIntegrations.push(Integration.JIRA);
            }
            if (integrationData.slack) {
                posthog.capture(PosthogEvents.USER_INTEGRATED_SLACK, {
                    email: user?.email || 'unknown',
                });
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

    return (
        <IntegrationContext.Provider value={{ integrations, isLoading, refreshIntegrations }}>
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