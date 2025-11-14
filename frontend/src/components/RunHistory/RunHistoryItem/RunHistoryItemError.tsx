import { XCircle } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

type Props = {
    errorMessage: string;
    isExpanded: boolean;
    onToggle: () => void;
};

export default function RunHistoryItemError({
    errorMessage,
    isExpanded,
    onToggle,
}: Props) {
    return (
        <div className="pl-8">
            <div className="text-foreground mb-3">
                Execution Error:
            </div>
            <div className="mt-3">
                <Accordion
                    type="single"
                    collapsible
                    value={isExpanded ? "error" : ""}
                    onValueChange={onToggle}
                >
                    <div className="rounded-lg border border-border">
                        <AccordionItem value="error" className="border-b-0">
                            <AccordionTrigger className="py-2 px-2 hover:no-underline hover:bg-accent/50">
                                <div className="flex items-center gap-2 w-full mr-2">
                                    <div>
                                        <XCircle className="w-4 h-4 text-destructive" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-foreground">
                                            Error
                                        </span>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="pt-2 pl-4 text-muted-foreground">
                                    {errorMessage}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>
                </Accordion>
            </div>
        </div>
    );
}

