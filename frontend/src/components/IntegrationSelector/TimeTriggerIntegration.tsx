import { InputConfigSelectorProps } from "./types";
import { ScheduleEditor, getCronDescription } from "../ScheduleEditor";
import { TimeTriggerConfig } from "@/shared/Configs";
import { ClockIcon } from "lucide-react";

export function TimeTriggerIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const currentConfig: TimeTriggerConfig = input.config
        ? (input.config as TimeTriggerConfig)
        : new TimeTriggerConfig(input.id, "0 9 * * *");

    if (variant === 'card') {
        const description = getCronDescription(currentConfig.cronExpression);
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="size-3 text-primary" />
                {description}
            </div>
        );
    }

    return (
        <ScheduleEditor
            value={currentConfig.cronExpression}
            onChange={(cronExpression) =>
                setConfig(new TimeTriggerConfig(currentConfig.integrationId, cronExpression))
            }
        />
    );
}