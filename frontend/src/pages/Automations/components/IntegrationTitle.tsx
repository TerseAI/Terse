import { IntegrationType } from "@/shared/Integrations"
import { IconForInputType } from "./Integration";
import { getIntegrationTypeName } from "../../../utility/IntegrationFormatters";

interface IntegrationTitleProps {
    integration: IntegrationType;
    iconSize?: "sm" | "md" | "lg";
    className?: string;
}

export function IntegrationTitle({ integration, iconSize = "sm", className = "" }: IntegrationTypeTitleProps) {
    const iconSizeClasses = {
        sm: "w-5 h-5",
        md: "w-6 h-6",
        lg: "w-8 h-8"
    };

    // Special case for Confluence/Jira - they share the same integration
    if (integration === IntegrationType.CONFLUENCE || integration === IntegrationType.JIRA) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center gap-0.5`}>
                    <div className="w-1/2 h-full flex items-center justify-center">
                        <IconForInputType type={IntegrationType.JIRA} />
                    </div>
                    <div className="w-1/2 h-full flex items-center justify-center">
                        <IconForInputType type={IntegrationType.CONFLUENCE} />
                    </div>
                </div>
                <span>Atlassian</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center`}>
                <IconForInputType type={integration} />
            </div>
            {getIntegrationTypeName(integration)}
        </div>
    );
}

