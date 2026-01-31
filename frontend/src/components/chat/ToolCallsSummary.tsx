import { useState } from "react";
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { FunctionCallEvent } from "./Turn";

interface ToolCallsSummaryProps {
    calls: FunctionCallEvent[];
}

export default function ToolCallsSummary({ calls }: ToolCallsSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (calls.length === 0) return null;

    const isAnyRunning = calls.some(c => c.isRunning);

    return (
        <div className="w-fit">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
                <ChevronRightIcon
                    className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                />
                {isAnyRunning ? (
                    <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : null}
                <span>
                    {calls.length} tool call{calls.length !== 1 ? 's' : ''}
                </span>
            </button>

            {isExpanded && (
                <div className="ml-4 mt-1 text-xs text-muted-foreground space-y-0.5">
                    {calls.map((call, index) => (
                        <div key={index} className="font-mono">
                            {call.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
