import { ExternalLink } from "lucide-react"
import { type RunHistoryAction, RunHistoryStatus } from "terse-types"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { capitalize } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"

type Props = {
    runId: string
    index: number
    action: RunHistoryAction
    runStatus: RunHistoryStatus
    isExpanded: boolean
    onToggle: (actionKey: string) => void
}

export default function RunHistoryActionItem({ runId, index, action, runStatus, isExpanded, onToggle }: Props) {
    const actionKey = `${runId}-action-${index}`

    const isScrubbed = action.action === "" && action.target === "" && action.details === ""

    const formatAction = (s: string) => {
        return s
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
    }

    return (
        <Accordion type="single" collapsible value={isExpanded ? actionKey : ""} onValueChange={() => onToggle(actionKey)}>
            <div className="rounded-lg border border-border">
                <AccordionItem value={actionKey} className="border-b-0">
                    <AccordionTrigger className="py-2 px-2 hover:no-underline">
                        <div className="flex items-center gap-2 w-full mr-2">
                            <div className="w-4 h-4 flex-shrink-0">
                                <IconForIntegration integration={action.integration} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    {isScrubbed ? (
                                        <span className="text-muted-foreground">
                                            {capitalize(action.integration)} · {capitalize(action.type)} action
                                        </span>
                                    ) : (
                                        <span className="text-foreground">
                                            {formatAction(action.action)} on {capitalize(action.integration)} → {action.target}
                                        </span>
                                    )}
                                    {!isScrubbed && action.url && (
                                        <a href={action.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:opacity-80 transition-opacity">
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        {isScrubbed ? (
                            <div className="px-2 pb-2 text-xs text-muted-foreground/80">Action details removed after 30 days</div>
                        ) : (
                            <div className={cn("p-2", runStatus === RunHistoryStatus.FAILED ? "text-danger" : "text-muted-foreground")}>{action.details}</div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </div>
        </Accordion>
    )
}
