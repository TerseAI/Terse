import { IntegrationType } from "@/shared/Integrations"
import { JiraConnectionForm } from "./JiraConnectionForm";
import { ConfluenceConnectionForm } from "./ConfluenceConnectionForm";
import { AtlassianConnectionFormProps } from "./types";

interface AtlassianConnectionFormWrapperProps extends AtlassianConnectionFormProps {
    integrationType: IntegrationType;
}

export function AtlassianConnectionForm({ 
    onSuccess, 
    onCancel, 
    integrationType 
}: AtlassianConnectionFormWrapperProps) {
    if (integrationType === IntegrationType.JIRA) {
        return <JiraConnectionForm onSuccess={onSuccess} onCancel={onCancel} />;
    } else if (integrationType === IntegrationType.CONFLUENCE) {
        return <ConfluenceConnectionForm onSuccess={onSuccess} onCancel={onCancel} />;
    } else {
        throw new Error(`Unsupported integration type: ${integrationType}`);
    }
}

// Export child components for direct use if needed
export { JiraConnectionForm } from "./JiraConnectionForm";
export { ConfluenceConnectionForm } from "./ConfluenceConnectionForm";

