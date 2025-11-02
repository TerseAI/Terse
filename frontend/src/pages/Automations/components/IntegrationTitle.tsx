import { Integration } from "../../../context/Integrations";
import { IconForInputType } from "./Integration";
import { getIntegrationTypeName } from "../../../utility/IntegrationFormatters";

interface IntegrationTitleProps {
    integration: Integration;
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
                <IconForInputType type={integration} />
            </div>
            {getIntegrationTypeName(integration)}
        </div>
    );
}

