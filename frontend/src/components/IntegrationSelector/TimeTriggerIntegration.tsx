import { useState } from "react";
import { InputConfigSelectorProps } from "./types";
import { ScheduleEditor, getCronDescription } from "../ScheduleEditor";
import { TimeTriggerConfig } from "@/shared/Configs";
import { AlertTriangleIcon, PlayIcon } from "lucide-react";
import { CalendarClockIcon } from "@/components/icons/IntegrationIcons";
import { Button } from "@/components/ui/button";
import { ManualTriggerDialog } from "../ManualTriggerDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TimeTriggerIntegration({ input, variant, setConfig, agentSaveState }: InputConfigSelectorProps) {
    const existingConfig = input.config as TimeTriggerConfig | undefined;
    const hasSchedule = existingConfig?.cronExpression?.trim();
    const [showManualTrigger, setShowManualTrigger] = useState(false);

    // Determine if trigger button should be disabled
    // Agent must be complete (all required fields filled) to trigger
    const canTrigger = agentSaveState?.isComplete ?? false;
    const isDisabled = !canTrigger;

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
                <div className="size-3 text-primary shrink-0">
                    <CalendarClockIcon />
                </div>
                {getCronDescription(existingConfig.cronExpression)}
            </div>
        );
    }

    const triggerButton = (
        <Button
            variant="outline"
            onClick={() => setShowManualTrigger(true)}
            className="w-full"
            disabled={isDisabled}
        >
            <PlayIcon className="size-4 mr-2" />
            Trigger Now
        </Button>
    );

    return (
        <div className="space-y-4">
            <ScheduleEditor
                value={existingConfig?.cronExpression ?? ""}
                onChange={(cronExpression) =>
                    setConfig(new TimeTriggerConfig(cronExpression))
                }
            />

            {hasSchedule && (
                <div className="pt-2 border-t border-border/50">
                    {isDisabled ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="w-full inline-block">
                                    {triggerButton}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                Complete all required fields before triggering
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        triggerButton
                    )}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        Run this automation immediately instead of waiting for the next scheduled time
                    </p>
                </div>
            )}

            <ManualTriggerDialog
                isOpen={showManualTrigger}
                onClose={() => setShowManualTrigger(false)}
                inputId={input.id}
                agentSaveState={agentSaveState}
            />
        </div>
    );
}