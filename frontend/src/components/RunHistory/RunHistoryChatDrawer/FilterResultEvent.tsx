import { CheckCircle2, XCircle } from 'lucide-react';
import { formatTimestamp, getFullTimestamp } from './utils';

type Props = {
    filterResult: { type: 'FilterResult'; isRelevant: boolean; reason: string; confidence: number; timestamp?: string };
};

export default function FilterResultEvent({ filterResult }: Props) {
    const { isRelevant, reason, confidence, timestamp } = filterResult;
    
    // Determine confidence color for the progress circle
    const getConfidenceColor = (conf: number) => {
        if (conf >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
        if (conf >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-orange-600 dark:text-orange-400';
    };
    
    // Calculate circle circumference for stroke-dasharray
    const radius = 6;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="mb-4 select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                        <div className="flex items-start gap-3 mb-3">
                            {isRelevant ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            ) : (
                                <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="text-sm font-semibold text-foreground">
                                        {isRelevant ? 'Event Approved' : 'Event Filtered Out'}
                                    </div>
                                    <div 
                                        className="relative w-4 h-4 flex-shrink-0"
                                        title={`Confidence: ${Math.round(confidence * 100)}%`}
                                    >
                                        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
                                            {/* Background circle */}
                                            <circle
                                                cx="8"
                                                cy="8"
                                                r={radius}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="text-muted-foreground/20"
                                            />
                                            {/* Progress circle */}
                                            <circle
                                                cx="8"
                                                cy="8"
                                                r={radius}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                className={getConfidenceColor(confidence)}
                                                strokeDasharray={circumference}
                                                strokeDashoffset={circumference * (1 - confidence)}
                                            />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap">{reason}</div>
                            </div>
                        </div>
                    </div>
                </div>
                {timestamp && (
                    <div className="text-xs text-muted-foreground flex-shrink-0 px-4" title={getFullTimestamp(timestamp)}>
                        {formatTimestamp(timestamp)}
                    </div>
                )}
            </div>
        </div>
    );
}

