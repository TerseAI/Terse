import { AlertTriangleIcon } from "lucide-react"

import { CalendarClockIcon } from "@/components/icons/IntegrationIcons"
import { TimeTriggerConfig } from "@/shared/Configs"

import { ScheduleEditor, getCronDescription } from "../ScheduleEditor"

import { InputConfigSelectorProps } from "./types"

export function TimeTriggerIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const existingConfig = input.config as TimeTriggerConfig | undefined
    const hasSchedule = existingConfig?.cronExpression?.trim()

    if (variant === "card") {
        if (!hasSchedule || !existingConfig) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure schedule
                </div>
            )
        }
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-3 text-primary shrink-0">
                    <CalendarClockIcon />
                </div>
                {getCronDescription(existingConfig.cronExpression)}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <ScheduleEditor value={existingConfig?.cronExpression ?? ""} onChange={cronExpression => setConfig(new TimeTriggerConfig(cronExpression))} />
        </div>
    )
}
