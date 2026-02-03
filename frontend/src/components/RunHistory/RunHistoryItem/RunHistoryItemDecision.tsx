import { CheckCircle2, Filter as FilterIcon } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/accordion"

type Props = {
    filtered: boolean
    reasoning: string
    isExpanded: boolean
    onToggle: () => void
}

export default function RunHistoryItemDecision({ filtered, reasoning, isExpanded, onToggle }: Props) {
    return (
        <Accordion type="single" collapsible value={isExpanded ? "decision" : ""} onValueChange={onToggle}>
            <div className="rounded-lg border border-border">
                <AccordionItem value="decision" className="border-b-0">
                    <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-accent/50">
                        <div className="flex items-center gap-2 w-full mr-2">
                            <div>{filtered ? <FilterIcon className="w-4 h-4 text-muted-foreground" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}</div>
                            <div className="flex-1">
                                <span className="text-foreground">{filtered ? "Skip" : "Take Action"}</span>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="pt-2 pl-4 text-muted-foreground">{reasoning}</div>
                    </AccordionContent>
                </AccordionItem>
            </div>
        </Accordion>
    )
}
