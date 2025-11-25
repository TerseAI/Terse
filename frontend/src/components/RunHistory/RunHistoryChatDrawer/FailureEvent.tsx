import { formatTimestamp, getFullTimestamp } from './utils';

type Props = {
    failureEvent: { type: 'Failure'; error: string; timestamp?: string };
};

export default function FailureEvent({ failureEvent }: Props) {
    return (
        <div key="failure" className="mb-4 select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="mb-1">
                        <div className="text-sm font-semibold text-red-600 dark:text-red-400">Error</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{failureEvent.error}</div>
                </div>
                {failureEvent.timestamp && (
                    <div className="text-xs text-muted-foreground flex-shrink-0 px-4" title={getFullTimestamp(failureEvent.timestamp)}>
                        {formatTimestamp(failureEvent.timestamp)}
                    </div>
                )}
            </div>
        </div>
    );
}

