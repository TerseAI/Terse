import { AddToSlack } from "../components/integrations/addIntengrations/AddSlack";
import { GithubIntegration } from "../components/integrations/GithubIntegration";
import { Integration, useIntegrations } from "../context/Integrations";
import { AddLinear } from "../components/integrations/addIntengrations/AddLinear";

function Integrations() {
    const { integrations } = useIntegrations();

    const sourceControlIntegrations = integrations.filter((integration) => integration === Integration.GITHUB);
    const issueTrackingIntegrations = integrations.filter((integration) => integration === Integration.JIRA || integration === Integration.LINEAR);
    const communicationIntegrations = integrations.filter((integration) => integration === Integration.SLACK);

    console.log(integrations);

    return (
        <div className="grid grid-cols-1 grid-rows-1 pt-4 pb-4">
            <h1 className="text-4xl font-bold pb-8">Your Integrations</h1>
            <div className="flex flex-col gap-8">
                <IntegrationSection integrations={sourceControlIntegrations} title="Source Control" fallback={<AddToSlack />} />
                <IntegrationSection
                    integrations={issueTrackingIntegrations}
                    title="Issue Tracking"
                    fallback={<AddLinear onIntegrationChange={async () => {}} />}
                />
                <IntegrationSection integrations={communicationIntegrations} title="Communication" fallback={<AddToSlack />} />
            </div>
        </div>
    )
}

function IntegrationSection({ integrations, title, fallback }: { integrations: Integration[], title: string, fallback: React.ReactNode }) {
    return (
        <div className="grid grid-flow-row gap-4">
            <h1 className="text-lg font-bold text-[theme(text-primary)]">{title}</h1>
            <IntegrationCardContent integrations={integrations} fallback={fallback} />
        </div>
    )
}

function IntegrationCardContent({ integrations, fallback }: { integrations: Integration[], fallback: React.ReactNode }) {
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

function IntegrationSwitch({ integration }: { integration: Integration }) {
    if (integration === Integration.GITHUB) {
        return <GithubIntegration />
    }
    if (integration === Integration.LINEAR) {
        return <AddLinear onIntegrationChange={async () => {}} />
    }
    if (integration === Integration.SLACK) {
        return <AddToSlack />
    }
    return null;
}

export default Integrations;