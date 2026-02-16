import { ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"

import { capitalize } from "../../lib/utils"
import { IconForIntegration } from "../../pages/Agents/components/Integration"
import { RunHistoryStatus, type RunHistoryAction } from "../../shared/RunHistoryTypes"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"

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
                                    <span className="text-foreground">
                                        {formatAction(action.action)} on {capitalize(action.integration)} → {action.target}
                                    </span>
                                    {action.url && (
                                        <a href={action.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:opacity-80 transition-opacity">
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className={cn("p-2", runStatus === RunHistoryStatus.FAILED ? "text-destructive" : "text-muted-foreground")}>{action.details}</div>
                    </AccordionContent>
                </AccordionItem>
            </div>
        </Accordion>
    )
}
