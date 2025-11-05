import { Integration } from "@/context/Integrations";
import NotionIntegrationCard from "./NotionIntegrationCard";

function IntegrationCard({ integration, integrationId }: { integration: Integration, integrationId: string }) {
    if (integration === Integration.NOTION_PAGE || integration === Integration.NOTION) {
        return (
            <NotionIntegrationCard integrationId={integrationId} />
        )
    } else if (integration === Integration.SLACK) {
        return (
            <div></div>
        )
    } else if (integration === Integration.LINEAR) {
        return (
            <div></div>
        )
    } else if (integration === Integration.JIRA) {
        return (
            <div></div>
        )
    } else if (integration === Integration.GITHUB) {
        return (
            <div></div>
        )
    } else if (integration === Integration.GMAIL) {
        return (
            <div></div>
        )
    }
    console.error(`Unknown integration: ${integration}`);
    return (
        <>
        </>
    )
}

export default IntegrationCard;