import { MessageSquare } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/** Shown when a run has finished loading but has no chat transcript to display. */
export function RunHistoryChatEmptyMessages() {
    return (
        <div className="flex min-h-[200px] flex-col justify-center py-2">
            <Empty className="min-h-0 flex-none border-0 bg-transparent p-4 gap-4 md:p-6">
                <EmptyHeader className="max-w-[min(100%,320px)]">
                    <EmptyMedia variant="icon">
                        <MessageSquare className="text-primary" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No messages for this run</EmptyTitle>
                    <EmptyDescription>Chat turns show up when the job logs tool calls or messages from agents.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    )
}
