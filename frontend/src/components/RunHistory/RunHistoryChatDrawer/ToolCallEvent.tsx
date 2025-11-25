import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IconForIntegration } from '@/pages/Channels/components/Integration';
import { ExternalLink } from 'lucide-react';
import { capitalize } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { RunHistoryStatus } from '@/shared/RunHistoryTypes';
import { formatTimestamp, getFullTimestamp, parseToolInfo, extractDocumentUrlFromChangedItems } from './utils';
import type { ToolCallData } from './useChatEvents';

type Props = {
    toolCallData: ToolCallData;
    stepId: string;
    isExpanded: boolean;
    onToggleExpand: (stepId: string, expanded: boolean) => void;
    status: RunHistoryStatus;
};

export default function ToolCallEvent({
    toolCallData,
    stepId,
    isExpanded,
    onToggleExpand,
    status,
}: Props) {
    const { toolCall, toolComplete } = toolCallData;
    const isCompleted = !!toolComplete;
    const isInProgress = !!toolCall && !toolComplete;
    
    // Get timestamps - use the latest one (endTimestamp if available, otherwise startTimestamp)
    const startTimestamp = toolCall?.timestamp;
    const endTimestamp = toolComplete?.timestamp;
    const displayTimestamp = endTimestamp || startTimestamp;
    
    // Use toolCall for info if available, otherwise use toolComplete
    const toolName = toolCall?.summary || toolComplete?.tool_name || 'Unknown Tool';
    const parameters = toolCall?.parameters || '{}';
    const toolInfo = parseToolInfo(toolName, parameters);
    
    // Try to extract URL from changed_items or parameters
    let url: string | null = toolInfo.url;
    if (!url && toolComplete?.changed_items && toolComplete.changed_items.length > 0) {
        url = extractDocumentUrlFromChangedItems(toolComplete.changed_items, toolInfo.integration);
    }
    
    return (
        <div key={`tool-${stepId}`} className="mb-4 select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <Accordion
                        type="single"
                        collapsible
                        value={isExpanded ? stepId : ""}
                        onValueChange={(value) => {
                            onToggleExpand(stepId, !!value);
                        }}
                    >
                        <div className="rounded-lg border border-border bg-card">
                            <AccordionItem value={stepId} className="border-b-0">
                                <AccordionTrigger className="py-2 px-4 hover:no-underline">
                                    <div className="flex items-center gap-2 w-full mr-2">
                                        {toolInfo.integration && (
                                            <div className="w-4 h-4 flex-shrink-0">
                                                <IconForIntegration integration={toolInfo.integration} />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-foreground text-sm">
                                                    {isCompleted && '✓ '}
                                                    {isInProgress && '⟳ '}
                                                    {toolInfo.action}
                                                    {toolInfo.integration && ` on ${capitalize(toolInfo.integration)}`}
                                                    {toolInfo.target && ` → ${toolInfo.target}`}
                                                    {isCompleted && toolComplete?.status && ` (${toolComplete.status})`}
                                                </span>
                                                {url && (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-primary hover:opacity-80 transition-opacity"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                        <AccordionContent>
                            <div className={cn(
                                "px-4 pb-2 text-xs space-y-3",
                                status === "failed" ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {toolCall && (
                                    <div>
                                        <div className="font-semibold mb-1 text-foreground">Input:</div>
                                        <pre className="whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded">
                                            {toolInfo.details}
                                        </pre>
                                    </div>
                                )}
                                {toolComplete && (
                                    <div>
                                        <div className="font-semibold mb-1 text-foreground">Status: {toolComplete.status}</div>
                                        {toolComplete.changed_items && toolComplete.changed_items.length > 0 && (
                                            <div className="mt-2">
                                                <div className="font-semibold mb-1">Changed Items:</div>
                                                {toolComplete.changed_items.map((changedItem, idx) => (
                                                    <div key={idx} className="ml-2">
                                                        {changedItem.type_name} ({changedItem.id}) - {changedItem.change_event_type}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isInProgress && (
                                    <div className="text-muted-foreground italic">
                                        Tool call in progress...
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </div>
            </Accordion>
                </div>
                {displayTimestamp && (
                    <div className="text-xs text-muted-foreground flex-shrink-0 px-4" title={
                        startTimestamp && endTimestamp 
                            ? `Started: ${getFullTimestamp(startTimestamp)}\nEnded: ${getFullTimestamp(endTimestamp)}`
                            : startTimestamp 
                                ? `Started: ${getFullTimestamp(startTimestamp)}`
                                : endTimestamp 
                                    ? `Ended: ${getFullTimestamp(endTimestamp)}`
                                    : ''
                    }>
                        {formatTimestamp(displayTimestamp)}
                    </div>
                )}
            </div>
        </div>
    );
}

