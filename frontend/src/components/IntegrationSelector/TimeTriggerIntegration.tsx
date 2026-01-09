import { InputConfigSelectorProps } from "./types";
import { ScheduleEditor, getCronDescription } from "../ScheduleEditor";
import { TimeTriggerConfig } from "@/shared/Configs";
import { ClockIcon, AlertTriangleIcon } from "lucide-react";

export function TimeTriggerIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const existingConfig = input.config as TimeTriggerConfig | undefined;
    const hasSchedule = existingConfig?.cronExpression?.trim();

    if (variant === 'card') {
        if (!hasSchedule || !existingConfig) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure schedule
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="size-3 text-primary shrink-0" />
                {getCronDescription(existingConfig.cronExpression)}
            </div>
        );
    }

    return (
        <ScheduleEditor
            value={existingConfig?.cronExpression ?? ""}
            onChange={(cronExpression) =>
                setConfig(new TimeTriggerConfig(input.id, cronExpression))
            }
        />
    );
}