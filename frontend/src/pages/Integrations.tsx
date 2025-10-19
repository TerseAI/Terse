import { AddToSlack } from "../components/integrations/addIntengrations/AddSlack";
import { GithubIntegration } from "../components/integrations/GithubIntegration";
import { Integration, useIntegrations } from "../context/Integrations";
import { AddLinear } from "../components/integrations/addIntengrations/AddLinear";
import AddGmail from "../components/integrations/addIntengrations/AddGmail";
import { AddNotion } from "../components/integrations/addIntengrations/AddNotion";

function Integrations() {
    const { integrations, isLoading, refreshIntegrations } = useIntegrations();

    const sourceControlIntegrations = integrations.filter((integration) => integration === Integration.GITHUB);
    const issueTrackingIntegrations = integrations.filter((integration) => integration === Integration.JIRA || integration === Integration.LINEAR);
    const communicationIntegrations = integrations.filter((integration) => integration === Integration.SLACK);
    const emailIntegrations = integrations.filter((integration) => integration === Integration.GMAIL);
    const noteTakingIntegrations = integrations.filter((integration) => integration === Integration.NOTION);

    console.log('emailIntegrations', emailIntegrations);

    return (
        <div className="grid grid-cols-1 grid-rows-1 pt-4 pb-4">
            <h1 className="text-4xl font-bold pb-8">Your Integrations</h1>
            <div className="flex flex-col gap-8">
                <IntegrationSection integrations={sourceControlIntegrations} title="Source Control" fallback={<GithubIntegration />} isLoading={isLoading} />
                <IntegrationSection
                    integrations={issueTrackingIntegrations}    
                    title="Issue Tracking"
                    fallback={<AddLinear onIntegrationChange={refreshIntegrations} />}
                    isLoading={isLoading}
                />
                <IntegrationSection integrations={noteTakingIntegrations} title="Note Taking" fallback={<AddNotion onIntegrationChange={refreshIntegrations} />} isLoading={isLoading} />
                <IntegrationSection integrations={communicationIntegrations} title="Communication" fallback={<AddToSlack />} isLoading={isLoading} />
                <IntegrationSection integrations={emailIntegrations} title="Email" fallback={<AddGmail />} isLoading={isLoading} />
            </div>
        </div>
    )
}

function IntegrationSection({ integrations, title, fallback, isLoading }: { integrations: Integration[], title: string, fallback: React.ReactNode, isLoading: boolean }) {
    return (
        <div className="grid grid-flow-row gap-4">
            <h1 className="text-lg font-bold text-[theme(text-primary)]">{title}</h1>
            <IntegrationCardContent integrations={integrations} fallback={fallback} isLoading={isLoading} />
        </div>
    )
}

function IntegrationCardContent({ integrations, fallback, isLoading }: { integrations: Integration[], fallback: React.ReactNode, isLoading: boolean }) {
    if (isLoading) {
        return <IntegrationCardLoadingState />
    }

    if (integrations.length === 0) {
        return (
            <div className="grid">
                {fallback}
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            {integrations.map((integration, index) => (
                <IntegrationSwitch key={index} integration={integration} />
            ))}
        </div>
    )
}

function IntegrationCardLoadingState() {
    return (
        <div className="animate-pulse rounded-lg bg-[theme(background-elevated)] h-24 w-full"></div>
    )
}

function IntegrationSwitch({ integration }: { integration: Integration }) {
    if (integration === Integration.GITHUB) {
        return <GithubIntegration />
    }
    if (integration === Integration.LINEAR) {
        return <AddLinear onIntegrationChange={async () => { }} />
    }
    if (integration === Integration.SLACK) {
        return <AddToSlack />
    }
    if (integration === Integration.GMAIL) {
        return <AddGmail />
    }
    if (integration === Integration.NOTION) {
        return <AddNotion onIntegrationChange={async () => { }} />
    }
    return null;
}

export default Integrations;