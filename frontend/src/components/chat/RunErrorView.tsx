/**
 * Displays run-level / agent-level errors with code-specific copy.
 * Used when a turn has isFailure and errorCode (from RunError events).
 */
type RunErrorViewProps = {
    error: string
    errorCode?: string
}

const CONTEXT_LENGTH_MESSAGE = "Context window exceeded. Try reducing scope/context and retrying."

export function RunErrorView({ error, errorCode }: RunErrorViewProps) {
    const isContextLength = errorCode === "context_length_exceeded"
    const displayMessage = isContextLength ? CONTEXT_LENGTH_MESSAGE : `Something went wrong. ${error}`

    return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <span className="select-text">{displayMessage}</span>
            </div>
        </div>
    )
}
