import { Skeleton } from "@/components/ui/skeleton";

export default function RunHistoryLoadingState() {
    return (
        <div className="mb-6">
            <div className="flex flex-col gap-3 overflow-x-auto md:overflow-visible pb-3 md:pb-0">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="overflow-hidden bg-[theme(background-light)] border border-[theme(border)] rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink"
                    >
                        <div className="p-4">
                            <div className="flex items-start gap-4">
                                {/* Chevron */}
                                <div className="mt-0.5 flex items-center gap-2">
                                    <Skeleton className="w-4 h-4" />
                                </div>
                                
                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                    {/* Title row with icon */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <Skeleton className="w-4 h-4 flex-shrink-0" />
                                        <Skeleton className="h-4 w-[300px]" />
                                    </div>
                                    
                                    {/* Subheader + timestamp */}
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3 w-[200px]" />
                                        <Skeleton className="h-2 w-1 rounded-full" />
                                        <Skeleton className="h-3 w-[60px]" />
                                    </div>
                                </div>
                                
                                {/* Status badge */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Skeleton className="h-6 w-[80px] rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

