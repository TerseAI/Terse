import { useState } from "react";
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { FunctionCallEvent } from "./Turn";
import FunctionCallItem from "./FunctionCallItem";
import ShinyText from "../ShinyText";

interface ToolCallsSummaryProps {
    calls: FunctionCallEvent[];
    isTurnFailure?: boolean;
    onApprove?: (stepId: string) => void;
    onReject?: (stepId: string) => void;
}

export default function ToolCallsSummary({ calls, isTurnFailure = false, onApprove, onReject }: ToolCallsSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (calls.length === 0) return null;

    const generatingCalls = calls.filter(c => c.isGeneratingParams);
    const runningCalls = calls.filter(c => c.isRunning && !c.isGeneratingParams);
    const completedCalls = calls.filter(c => !c.isRunning && !c.isGeneratingParams);
    const hasAnyWaitingForApproval = calls.some(c => c.isWaitingForApproval && !c.isRejected);

    // Auto-expand if any call is waiting for approval
    const shouldShowExpanded = isExpanded || hasAnyWaitingForApproval;

    // Format in-progress calls into single lines
    const generatingText = formatToolCallsText(generatingCalls.map(c => c.name), "preparing");
    const runningText = formatToolCallsText(runningCalls.map(c => c.name), "calling");

    return (
        <div className="w-fit space-y-2">
            {/* Show shiny text for generating params */}
            {generatingText && (
                <div className="py-1">
                    <ShinyText
                        text={generatingText}
                        speed={1.5}
                        className="text-sm"
                    />
                </div>
            )}

            {/* Show shiny text for running calls */}
            {runningText && (
                <div className="py-1">
                    <ShinyText
                        text={runningText}
                        speed={1.5}
                        className="text-sm"
                    />
                </div>
            )}

            {/* Show expandable summary for completed calls */}
            {completedCalls.length > 0 && (
                <>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                        <ChevronRightIcon
                            className={`w-3 h-3 transition-transform duration-200 ${shouldShowExpanded ? 'rotate-90' : ''}`}
                        />
                        <span>
                            {completedCalls.length} tool call{completedCalls.length !== 1 ? 's' : ''}
                            {hasAnyWaitingForApproval && (
                                <span className="text-yellow-500 ml-1">(approval needed)</span>
                            )}
                        </span>
                    </button>

                    {shouldShowExpanded && (
                        <div className="ml-4 mt-2 space-y-2">
                            {completedCalls.map((call, index) => (
                                <FunctionCallItem
                                    key={`${call.id}-${index}`}
                                    call={call}
                                    index={index}
                                    isTurnFailure={isTurnFailure}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Formats a list of tool call names into a human-readable single-line string.
 *
 *
 * Examples with prefix "calling":
 * - ["fetchResources"] -> "calling fetchResources..."
 * - ["fetchResources", "fetchResources"] -> "calling fetchResources x2..."
 * - ["fetchResources", "applyAgent"] -> "calling fetchResources and applyAgent..."
 * - ["fetchResources", "fetchResources", "applyAgent"] -> "calling fetchResources x2 and applyAgent..."
 * - ["a", "b", "c"] -> "calling a, b, and c..."
 * - ["a", "a", "b", "c"] -> "calling a x2, b, and c..."
 */
export function formatToolCallsText(toolNames: string[], prefix: string): string {
    if (toolNames.length === 0) return "";

    // Count occurrences of each tool name
    const counts = new Map<string, number>();
    for (const name of toolNames) {
        counts.set(name, (counts.get(name) || 0) + 1);
    }

    // Build formatted parts preserving order of first occurrence
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const name of toolNames) {
        if (seen.has(name)) continue;
        seen.add(name);

        const count = counts.get(name)!;
        if (count > 1) {
            parts.push(`${name} x${count}`);
        } else {
            parts.push(name);
        }
    }

    // Join parts with proper grammar
    let joined: string;
    if (parts.length === 1) {
        joined = parts[0];
    } else if (parts.length === 2) {
        joined = `${parts[0]} and ${parts[1]}`;
    } else {
        joined = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
    }

    return `${prefix} ${joined}...`;
}