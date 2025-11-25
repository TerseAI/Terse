import { formatTimestamp, getFullTimestamp } from './utils';

type Props = {
    timestamp?: string;
};

export default function StopEvent({ timestamp }: Props) {
    return (
        <div key="stop" className="mb-4 p-3 bg-muted rounded-lg select-text">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">Agent completed</div>
                {timestamp && (
                    <div className="text-xs text-muted-foreground flex-shrink-0" title={getFullTimestamp(timestamp)}>
                        {formatTimestamp(timestamp)}
                    </div>
                )}
            </div>
        </div>
    );
}

