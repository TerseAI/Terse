import { useState } from "react"

import { CheckCircleIcon, CheckIcon, ClockIcon, NoSymbolIcon, PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline"

import { useRunHistoryActions } from "../../hooks/useRunHistoryActions"
import { EntityType } from "../../shared/Entities"
import { ChangedItem } from "../../shared/ModelEvents"
import { getToolDisplayFromCall } from "../../utility/toolDisplayUtils"
import RunHistoryActionItem from "../RunHistory/RunHistoryActionItem"
import ToolCallParameters from "../ToolCallParameters"
import { Button } from "../ui/button"

import { FunctionCallEvent } from "./Turn"

interface FunctionCallItemProps {
    call: FunctionCallEvent
    isTurnFailure?: boolean
    index: number
    onApprove?: (stepId: string) => void
    onReject?: (stepId: string) => void
}

function ToolActionsDisplay({ changedItems, isTurnFailure }: { changedItems?: ChangedItem[]; isTurnFailure?: boolean }) {
    if (!changedItems || changedItems.length === 0) return null

    const actionIds = changedItems.filter(item => item.type_name === EntityType.RUN_HISTORY_ACTION).map(item => item.id)

    if (actionIds.length === 0) return null

    return <ToolActionsList actionIds={actionIds} isTurnFailure={isTurnFailure} />
}

function ToolActionsList({ actionIds, isTurnFailure }: { actionIds: string[]; isTurnFailure?: boolean }) {
    const { actions } = useRunHistoryActions(actionIds)
    const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())

    const toggleAction = (actionKey: string) => {
        const newExpanded = new Set(expandedActions)
        if (newExpanded.has(actionKey)) {
            newExpanded.delete(actionKey)
        } else {
            newExpanded.add(actionKey)
        }
        setExpandedActions(newExpanded)
    }

    if (!actions || actions.length === 0) return null

    return (
        <div className="mt-2 space-y-2">
            {actions.map((action, index) => (
                <RunHistoryActionItem
                    key={action.id}
                    runId={action.id}
                    index={index}
                    action={action}
                    runStatus={isTurnFailure ? "failed" : "success"}
                    isExpanded={expandedActions.has(`${action.id}-action-${index}`)}
                    onToggle={toggleAction}
                />
            ))}
        </div>
    )
}

function ToolResultInput({ toolName, parameters, onSubmit }: { toolName: string; parameters?: string; onSubmit: (result: string) => void }) {
    const [result, setResult] = useState("")
    const [submitted, setSubmitted] = useState(false)
    const [submittedValue, setSubmittedValue] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (result.trim()) {
            setSubmittedValue(result.trim())
            setSubmitted(true)
            onSubmit(result.trim())
            setResult("")
        }
    }

    // Parse parameters if they exist
    let parsedParams = null
    if (parameters) {
        try {
            parsedParams = JSON.parse(parameters)
        } catch (e) {
            // If parsing fails, treat as plain text
            parsedParams = parameters
        }
    }

    // Show collapsed view if submitted
    if (submitted) {
        return (
            <div className="bg-card rounded-lg p-3 mt-2 border border-green-500/20">
                <div className="text-sm text-muted-foreground mb-2">
                    Result provided for <span className="font-medium text-foreground">{toolName}</span>:
                </div>
                <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-mono bg-background px-2 py-1 rounded select-text">{submittedValue}</span>
                </div>
            </div>
        )
    }

    // Show input form if not submitted yet
    return (
        <div className="bg-card rounded-lg p-3 mt-2">
            <div className="text-sm text-muted-foreground mb-2">
                Please provide the result for <span className="font-medium text-foreground">{toolName}</span>:
            </div>

            {parameters && parsedParams && typeof parsedParams === "object" && Object.keys(parsedParams).length > 0 && (
                <div className="mb-3 p-2 bg-background rounded border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Parameters:</div>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono select-text">{JSON.stringify(parsedParams, null, 2)}</pre>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                    type="text"
                    value={result}
                    onChange={e => setResult(e.target.value)}
                    placeholder="Enter tool result..."
                    className="w-full text-foreground text-sm resize-none p-2.5 leading-normal placeholder:italic placeholder:text-muted-foreground rounded-lg transition-all duration-300 focus:outline-none bg-card"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!result.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send
                </button>
            </form>
        </div>
    )
}

export default function FunctionCallItem({ call, isTurnFailure = false, index, onApprove, onReject }: FunctionCallItemProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    // Get display name based on current state
    const phase = call.isRunning ? "executing" : "complete"
    const displayName = getToolDisplayFromCall(call.name, phase, call.parameters, call.result)

    const handleApprove = () => {
        if (!onApprove) return
        onApprove(call.id)
    }

    const handleReject = () => {
        if (!onReject) return
        onReject(call.id)
    }

    const hasExpandableContent = !!(call.parameters || call.errorContext || (call.changed_items && call.changed_items.length > 0))

    const statusIcon = call.isWaitingForApproval ? (
        <ClockIcon className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
    ) : call.isRejected ? (
        <NoSymbolIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
    ) : call.isFailure ? (
        <XMarkIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
    ) : call.isApproved ? (
        <CheckCircleIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
    ) : call.isWaitingForUserInput ? (
        <ClockIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
    ) : (
        <CheckIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    )

    return (
        <div>
            <button
                onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 py-0.5 text-sm text-muted-foreground transition-colors ${hasExpandableContent ? "hover:text-foreground cursor-pointer" : "cursor-default"}`}
            >
                {statusIcon}
                <span className="text-left">
                    {displayName}
                    {call.isWaitingForApproval && !call.isRejected && <span className="text-yellow-500 ml-1">(approval needed)</span>}
                    {call.isApproved && <span className="text-primary ml-1">(approved)</span>}
                    {call.isRejected && <span className="text-orange-500 ml-1">(rejected)</span>}
                    {call.isWaitingForUserInput && <span className="text-blue-500 ml-1">(needs input)</span>}
                </span>
            </button>

            {isExpanded && (
                <div className="ml-6 mt-1 space-y-2 border-l border-border pl-3">
                    {call.parameters && <ToolCallParameters parameters={call.parameters} />}
                    {call.errorContext && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <div className="text-sm font-semibold text-red-500 mb-1">Error:</div>
                            <div className="text-sm text-red-400 font-mono whitespace-pre-wrap select-text">{String(call.errorContext.error)}</div>
                        </div>
                    )}
                    <ToolActionsDisplay changedItems={call.changed_items} isTurnFailure={isTurnFailure} />
                </div>
            )}

            {call.isWaitingForUserInput && <ToolResultInput toolName={displayName} parameters={call.parameters} onSubmit={() => {}} />}

            {call.isWaitingForApproval && !call.isRejected && (
                <div className="ml-6 mt-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="text-sm text-muted-foreground mb-2">
                        The bot wants to execute: <span className="font-medium text-foreground">{displayName}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleApprove} size="sm" variant="default">
                            Approve
                        </Button>
                        <Button onClick={handleReject} size="sm" variant="destructive">
                            Reject
                        </Button>
                    </div>
                </div>
            )}

            {call.isApproved && !call.isRunning && (
                <div className="ml-6 mt-1 flex items-center gap-2 text-sm text-primary">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>Approved</span>
                </div>
            )}

            {call.isRejected && (
                <div className="ml-6 mt-1 flex items-center gap-2 text-sm text-orange-500">
                    <NoSymbolIcon className="w-3.5 h-3.5" />
                    <span>Rejected</span>
                </div>
            )}
        </div>
    )
}
