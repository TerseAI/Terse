import { ClockIcon } from "lucide-react";
import { InputConfigSelectorProps } from "./types";
import { ScheduleEditor } from "../ScheduleEditor";
import { TimeTriggerConfig } from "@/shared/Configs";


export function TimeTriggerIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const currentConfig: TimeTriggerConfig = input.config ? input.config as TimeTriggerConfig : new TimeTriggerConfig(input.id, "");
    return (
        <div>
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="size-3 text-primary" />
                Run on a schedule (daily, weekly, etc.)
                <ScheduleEditor value={currentConfig.cronExpression} onChange={(cronExpression) => setConfig(new TimeTriggerConfig(currentConfig.integrationId, cronExpression))} />
            </div>
        </div>
    );
}