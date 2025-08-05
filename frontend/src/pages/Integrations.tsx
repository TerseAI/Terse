import { GithubIntegration } from "../components/integrations/GithubIntegration";
import { Integration, useIntegrations } from "../context/Integrations";

function Integrations() {
    const { integrations } = useIntegrations();

    const sourceControlIntegrations = integrations.filter((integration) => integration === Integration.GITHUB);
    const issueTrackingIntegrations = integrations.filter((integration) => integration === Integration.JIRA || integration === Integration.LINEAR);
    const communicationIntegrations = integrations.filter((integration) => integration === Integration.SLACK);

    return (
        <div className="grid grid-cols-1 grid-rows-1 pt-4 pb-4">
            <h1 className="text-4xl font-bold pb-8">Your Integrations</h1>
            <div className="flex flex-col gap-4">
                <IntegrationSection integrations={sourceControlIntegrations} title="Source Control" />
                <IntegrationSection integrations={issueTrackingIntegrations} title="Issue Tracking" />
                <IntegrationSection integrations={communicationIntegrations} title="Communication" />
            </div>
        </div>
    )
}

function IntegrationSection({ integrations, title }: { integrations: Integration[], title: string }) {
    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-lg font-bold text-[theme(text-primary)]">{title}</h1>
            <IntegrationCardContent integrations={integrations} />
        </div>
    )
}

function IntegrationCardContent({ integrations }: { integrations: Integration[] }) {
    if (integrations.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <h1>No integrations</h1>
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

function IntegrationSwitch({ integration }: { integration: Integration }) {
    if (integration === Integration.GITHUB) {
        return <GithubIntegration />
    }
    return null;
}

export default Integrations;