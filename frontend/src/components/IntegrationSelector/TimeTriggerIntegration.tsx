import { useState } from "react";
import { InputConfigSelectorProps } from "./types";
import { ScheduleEditor, getCronDescription } from "../ScheduleEditor";
import { TimeTriggerConfig } from "@/shared/Configs";
import { AlertTriangleIcon, PlayIcon, Loader2Icon } from "lucide-react";
import { CalendarClockIcon } from "@/components/icons/IntegrationIcons";
import { Button } from "@/components/ui/button";
import { ManualTriggerDialog } from "../ManualTriggerDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function TimeTriggerIntegration({ input, variant, setConfig, agentSaveState }: InputConfigSelectorProps) {
    const existingConfig = input.config as TimeTriggerConfig | undefined;
    const hasSchedule = existingConfig?.cronExpression?.trim();
    const [showManualTrigger, setShowManualTrigger] = useState(false);
    const [isSavingBeforeTrigger, setIsSavingBeforeTrigger] = useState(false);

    // Determine if the trigger button should be disabled
    const canTrigger = agentSaveState?.isComplete ?? false;
    const isSavedAgent = agentSaveState?.isSavedAgent ?? false;
    const isDisabled = !canTrigger || isSavingBeforeTrigger || agentSaveState?.isSaving;

    const handleTriggerClick = async () => {
        if (!agentSaveState) {
            // Fallback: if no save state provided, just open the dialog
            setShowManualTrigger(true);
            return;
        }

        // If agent is complete but has unsaved changes, save first
        if (agentSaveState.isComplete && !isSavedAgent) {
            setIsSavingBeforeTrigger(true);
            const success = await agentSaveState.saveAgent();
            setIsSavingBeforeTrigger(false);
            if (!success) {
                return; // Save failed, don't open trigger dialog
            }
        } else if (agentSaveState.isComplete && isSavedAgent) {
            // Agent is saved but may have unsaved changes - save to ensure backend is up to date
            setIsSavingBeforeTrigger(true);
            const success = await agentSaveState.saveAgent();
            setIsSavingBeforeTrigger(false);
            if (!success) {
                return;
            }
        }

        setShowManualTrigger(true);
    };

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
            onClick={handleTriggerClick}
            disabled={isDisabled}
            className="w-full"
        >
            {isSavingBeforeTrigger ? (
                <>
                    <Loader2Icon className="size-4 mr-2 animate-spin" />
                    Saving...
                </>
            ) : (
                <>
                    <PlayIcon className="size-4 mr-2" />
                    Trigger Now
                </>
            )}
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
                    {isDisabled && !isSavingBeforeTrigger ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="w-full inline-block">
                                    {triggerButton}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                Complete all required fields to enable triggering
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
            />
        </div>
    );
}