import { ClockIcon } from '@heroicons/react/24/outline';

export function ActivityFeedEmpty({ className = '' }: { className?: string }) {
    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
            <div className="p-6">
                <div className="text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClockIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">No activity yet</h3>
                    <p className="text-slate-500 leading-relaxed max-w-md mx-auto text-sm">
                        Activity will appear here once you start making changes to your repositories.
                    </p>
                </div>
            </div>
        </div>
    );
}
