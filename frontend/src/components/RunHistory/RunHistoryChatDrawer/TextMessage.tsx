import { formatTimestamp, getFullTimestamp } from './utils';

type Props = {
    text: string;
    timestamp?: string;
    stepId: string;
};

export default function TextMessage({ text, timestamp, stepId }: Props) {
    if (!text) return null;
    
    return (
        <div key={`text-${stepId}`} className="mb-4 select-text">
            <div className="px-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-foreground whitespace-pre-wrap flex-1">{text}</div>
                    {timestamp && (
                        <div className="text-xs text-muted-foreground flex-shrink-0" title={getFullTimestamp(timestamp)}>
                            {formatTimestamp(timestamp)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

