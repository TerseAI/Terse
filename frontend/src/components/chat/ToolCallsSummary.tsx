import { getToolDisplayFromCall } from "../../utility/toolDisplayUtils"
import ShinyText from "../ShinyText"

import FunctionCallItem from "./FunctionCallItem"
import { FunctionCallEvent } from "./Turn"

interface ToolCallsSummaryProps {
    calls: FunctionCallEvent[]
    isTurnFailure?: boolean
    onApprove?: (stepId: string) => void
    onReject?: (stepId: string) => void
}

export default function ToolCallsSummary({ calls, isTurnFailure = false, onApprove, onReject }: ToolCallsSummaryProps) {
    if (calls.length === 0) return null

    const generatingCalls = calls.filter(c => c.isGeneratingParams)
    const runningCalls = calls.filter(c => c.isRunning && !c.isGeneratingParams)
    const completedCalls = calls.filter(c => !c.isRunning && !c.isGeneratingParams)

    // Format in-progress calls into single lines using display names
    const generatingText = formatToolCallsWithDisplay(generatingCalls, "preparing")
    const runningText = formatToolCallsWithDisplay(runningCalls, "executing")

    return (
        <div className="w-fit space-y-0.5">
            {/* Show shiny text for generating params */}
            {generatingText && (
                <div className="py-0.5">
                    <ShinyText text={generatingText} speed={1.5} className="text-sm" />
                </div>
            )}

            {/* Show shiny text for running calls */}
            {runningText && (
                <div className="py-0.5">
                    <ShinyText text={runningText} speed={1.5} className="text-sm" />
                </div>
            )}

            {/* Flat list of completed calls */}
            {completedCalls.length > 0 && (
                <div className="space-y-0.5">
                    {completedCalls.map((call, index) => (
                        <FunctionCallItem key={`${call.id}-${index}`} call={call} index={index} isTurnFailure={isTurnFailure} onApprove={onApprove} onReject={onReject} />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Formats a list of tool calls into a human-readable single-line string using display names.
 *
 * Examples:
 * - Single call: "Fetching resources from Notion..."
 * - Multiple same: "Fetching resources from Notion x2..."
 * - Multiple different: "Fetching resources from Notion and Creating ticket..."
 */
function formatToolCallsWithDisplay(calls: FunctionCallEvent[], phase: "preparing" | "executing"): string {
    if (calls.length === 0) return ""

    // Get display text for each call
    const displayTexts = calls.map(call => getToolDisplayFromCall(call.name, phase, call.parameters, call.result))

    // Count occurrences of each display text
    const counts = new Map<string, number>()
    for (const text of displayTexts) {
        counts.set(text, (counts.get(text) || 0) + 1)
    }

    // Build formatted parts preserving order of first occurrence
    const seen = new Set<string>()
    const parts: string[] = []
    for (const text of displayTexts) {
        if (seen.has(text)) continue
        seen.add(text)

        const count = counts.get(text)!
        if (count > 1) {
            parts.push(`${text} x${count}`)
        } else {
            parts.push(text)
        }
    }

    // Join parts with proper grammar
    let joined: string
    if (parts.length === 1) {
        joined = parts[0]
    } else if (parts.length === 2) {
        joined = `${parts[0]} and ${parts[1]}`
    } else {
        joined = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
    }

    return `${joined}...`
}
