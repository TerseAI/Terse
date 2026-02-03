import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs"

import { IconForConfigType } from "./Integration"

interface ConfigTitleProps {
    configType: ConfigType
    iconSize?: "sm" | "md" | "lg"
    className?: string
}

export function ConfigTitle({ configType, iconSize = "sm", className = "" }: ConfigTitleProps) {
    const iconSizeClasses = {
        sm: "w-5 h-5",
        md: "w-6 h-6",
        lg: "w-8 h-8"
    }

    // Special case for Confluence/Jira - they share the same integration
    if (configType === ConfigType.CONFLUENCE || configType === ConfigType.JIRA) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center gap-0.5`}>
                    <div className="w-1/2 h-full flex items-center justify-center">
                        <IconForConfigType type={configType} />
                    </div>
                </div>
                <span>{CONFIG_DETAILS[configType].name}</span>
            </div>
        )
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${iconSizeClasses[iconSize]} flex items-center justify-center`}>
                <IconForConfigType type={configType} />
            </div>
            {CONFIG_DETAILS[configType].name}
        </div>
    )
}
