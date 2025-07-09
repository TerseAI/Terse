import { createContext, useContext, useState, ReactNode } from 'react';

export enum Integration {
    JIRA = 'jira',
    LINEAR = 'linear',
    SLACK = 'slack',
    GITHUB = 'github',
}
type IntegrationContextType = {
    integrations: Integration[];
    addIntegration: (integration: Integration) => void;
    removeIntegration: (integration: Integration) => void;
}

const IntegrationContext = createContext<IntegrationContextType | undefined>(undefined);

export function IntegrationProvider({ children }: { children: ReactNode }) {
    const [integrations, setIntegrations] = useState<Integration[]>([]);

    const addIntegration = (integration: Integration) => {
        console.log('addIntegration', integration);
        // make sure it's not already in the list
        if (integrations.some(a => a === integration)) {
            return;
        }       
        setIntegrations([...integrations, integration]);
    }
    const removeIntegration = (integration: Integration) => {
        console.log('removeIntegration', integration);
        setIntegrations(integrations.filter(a => !(a == integration)));
    }

    return (
        <IntegrationContext.Provider value={{ integrations, addIntegration, removeIntegration }}>
            <div>
                {integrations.map(integration => (
                    <div key={integration}>{integration}</div>
                ))}
            </div>
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