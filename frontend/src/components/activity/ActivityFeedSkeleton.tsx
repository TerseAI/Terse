export function ActivityFeedSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-light text-slate-900 tracking-tight">Activity</h2>
                    <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse"></div>
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start space-x-3 p-4 border border-slate-200/60 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-25">
                            <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-slate-200 rounded-lg w-3/4 animate-pulse"></div>
                                <div className="h-2 bg-slate-200 rounded-lg w-1/2 animate-pulse"></div>
                                <div className="h-2 bg-slate-200 rounded-lg w-2/3 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
