import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { BackendProvider } from '../services/backend';

export enum Integration {
    // Ticketing systems
    JIRA = 'jira',
    LINEAR = 'linear',

    // Messaging systems
    SLACK = 'slack',

    // Source control
    GITHUB = 'github',

    // Note-taking systems
    NOTION = 'notion',
    
    // Mail
    GMAIL = 'gmail',
}

type IntegrationContextType = {
    integrations: Integration[];
    isLoading: boolean;
    refreshIntegrations: () => Promise<void>;
    hasGithub: boolean;
    hasLinear: boolean;
    hasJira: boolean;
    hasSlack: boolean;
    hasGmail: boolean;
    isSetupComplete: boolean;
    isPolling: boolean;
    startPolling: () => void;
    stopPolling: () => void;
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: ReactNode }) {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(false);
    const pollingIntervalRef = useRef<number | null>(null);
    const pollingTimeoutRef = useRef<number | null>(null);
    const lastIntegrationStateRef = useRef<string>('');
    const pollingStartTimeRef = useRef<number>(0);

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
            if (integrationData.gmail) {
                activeIntegrations.push(Integration.GMAIL);
            }

            setIntegrations(activeIntegrations);
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setIntegrations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const startPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
        }

        // Get current state from the server as baseline
        const getCurrentState = async () => {
            try {
                const { integrations: integrationData } = await BackendProvider.getIntegrationsStatus();
                lastIntegrationStateRef.current = JSON.stringify(integrationData);
                console.log('Polling started with baseline state:', integrationData);
            } catch (error) {
                console.error('Error getting baseline state:', error);
                // Fallback to current local state
                const currentIntegrations = {
                    github: integrations.includes(Integration.GITHUB),
                    linear: integrations.includes(Integration.LINEAR),
                    jira: integrations.includes(Integration.JIRA),
                    slack: integrations.includes(Integration.SLACK),
                    gmail: integrations.includes(Integration.GMAIL)
                };
                lastIntegrationStateRef.current = JSON.stringify(currentIntegrations);
            }
        };

        getCurrentState();
        pollingStartTimeRef.current = Date.now();
        setIsPolling(true);
        
        // Set a timeout to stop polling after 2 minutes
        pollingTimeoutRef.current = window.setTimeout(() => {
            console.log('Polling timeout reached, stopping');
            stopPolling();
        }, 120000);

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const { integrations: integrationData } = await BackendProvider.getIntegrationsStatus();
                const currentState = JSON.stringify(integrationData);
                const lastState = lastIntegrationStateRef.current;
                
                console.log('Polling check:', {
                    current: integrationData,
                    last: JSON.parse(lastState),
                    changed: currentState !== lastState,
                    elapsed: Date.now() - pollingStartTimeRef.current
                });
                
                // If state changed, update integrations and stop polling
                if (currentState !== lastState) {
                    console.log('Integration state changed, stopping polling');
                    lastIntegrationStateRef.current = currentState;
                    
                    // Update local state
                    const activeIntegrations: Integration[] = [];
                    if (integrationData.github) activeIntegrations.push(Integration.GITHUB);
                    if (integrationData.linear) activeIntegrations.push(Integration.LINEAR);
                    if (integrationData.jira) activeIntegrations.push(Integration.JIRA);
                    if (integrationData.slack) activeIntegrations.push(Integration.SLACK);
                    if (integrationData.gmail) activeIntegrations.push(Integration.GMAIL);

                    setIntegrations(activeIntegrations);
                    stopPolling();
                }
            } catch (error) {
                console.error('Error polling integrations:', error);
            }
        }, 2000); // Poll every 2 seconds
    };

    const stopPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
        setIsPolling(false);
        console.log('Polling stopped');
    };

    useEffect(() => {
        refreshIntegrations();
        
        // Cleanup polling on unmount
        return () => {
            stopPolling();
        };
    }, []);

    // Compute integration status
    const hasGithub = integrations.includes(Integration.GITHUB);
    const hasLinear = integrations.includes(Integration.LINEAR);
    const hasJira = integrations.includes(Integration.JIRA);
    const hasSlack = integrations.includes(Integration.SLACK);
    const hasGmail = integrations.includes(Integration.GMAIL)
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
            hasGmail,
            isSetupComplete,
            isPolling,
            startPolling,
            stopPolling
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