import { XCircleIcon } from '@heroicons/react/24/outline';

interface ActivityFeedErrorProps {
    message: string;
    onRetry: () => void;
    className?: string;
}

export function ActivityFeedError({ message, onRetry, className = '' }: ActivityFeedErrorProps) {
    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
            <div className="p-6">
                <div className="text-center">
                    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircleIcon className="w-6 h-6 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">Unable to load activity</h3>
                    <p className="text-slate-500 mb-4 leading-relaxed text-sm">{message}</p>
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 text-sm font-medium tracking-wide"
                    >
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}
