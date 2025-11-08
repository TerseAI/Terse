import { Integration } from "@/types/Integration";
import { JiraConnectionForm } from "./JiraConnectionForm";
import { ConfluenceConnectionForm } from "./ConfluenceConnectionForm";
import { AtlassianConnectionFormProps } from "./types";

interface AtlassianConnectionFormWrapperProps extends AtlassianConnectionFormProps {
    integrationType: Integration;
}

export function AtlassianConnectionForm({ 
    onSuccess, 
    onCancel, 
    integrationType 
}: AtlassianConnectionFormWrapperProps) {
    if (integrationType === Integration.JIRA) {
        return <JiraConnectionForm onSuccess={onSuccess} onCancel={onCancel} />;
    } else if (integrationType === Integration.CONFLUENCE) {
        return <ConfluenceConnectionForm onSuccess={onSuccess} onCancel={onCancel} />;
    } else {
        throw new Error(`Unsupported integration type: ${integrationType}`);
    }
}

// Export child components for direct use if needed
export { JiraConnectionForm } from "./JiraConnectionForm";
export { ConfluenceConnectionForm } from "./ConfluenceConnectionForm";

