import { IconForConfigType } from "./Integration";
import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs";

interface ConfigTitleProps {
    configType: ConfigType;
    iconSize?: "sm" | "md" | "lg";
    className?: string;
}

export function ConfigTitle({ configType, iconSize = "sm", className = "" }: ConfigTitleProps) {
    const iconSizeClasses = {
        sm: "w-5 h-5",
        md: "w-6 h-6",
        lg: "w-8 h-8"
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center`}>
                <IconForConfigType type={configType} />
            </div>
            {CONFIG_DETAILS[configType].name}
        </div>
    );
}

