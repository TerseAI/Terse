import { IntegrationType } from "@/shared/Integrations"
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
    if (integrationType === IntegrationType.ATLASSIAN) {
        return <ConfluenceConnectionForm onSuccess={onSuccess} onCancel={onCancel} />;
    } else {
        throw new Error(`Unsupported integration type: ${integrationType}`);
    }
}

