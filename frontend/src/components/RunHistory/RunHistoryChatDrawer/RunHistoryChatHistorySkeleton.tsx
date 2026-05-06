import { Skeleton } from "@/components/ui/skeleton"

export function RunHistoryChatHistorySkeleton() {
    return (
        <div className="flex w-full flex-col gap-5 pt-1" role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading conversation history for this run</span>
            <p className="text-center text-sm text-muted-foreground px-2">Fetching messages from this run…</p>
            <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                    <Skeleton className="h-11 w-[min(72%,280px)] rounded-lg" />
                </div>
                <div className="flex justify-start">
                    <div className="max-w-[90%] w-full space-y-2">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-[92%] rounded-md" />
                        <Skeleton className="h-4 w-[55%] rounded-md" />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Skeleton className="h-9 w-[min(48%,200px)] rounded-lg" />
                </div>
                <div className="flex justify-start">
                    <div className="max-w-[90%] w-full space-y-2">
                        <Skeleton className="h-4 w-[88%] rounded-md" />
                        <Skeleton className="h-4 w-[72%] rounded-md" />
                    </div>
                </div>
            </div>
        </div>
    )
}
