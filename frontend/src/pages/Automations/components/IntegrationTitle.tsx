import { IconForIntegration } from "./Integration";
import { INTEGRATION_METADATA, IntegrationType } from "@/shared/Integrations";

interface IntegrationTitleProps {
    integration: IntegrationType;
    iconSize?: "sm" | "md" | "lg";
    className?: string;
}

export function IntegrationTitle({ integration, iconSize = "sm", className = "" }: IntegrationTitleProps) {
    const iconSizeClasses = {
        sm: "w-5 h-5",
        md: "w-6 h-6",
        lg: "w-8 h-8"
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center`}>
                <IconForIntegration integration={integration} />
            </div>
            {INTEGRATION_METADATA[integration].name}
        </div>
    );
}

