import { Turn } from "../Turn"

export function canAppendProcessOutputToTurn(turn?: Turn): boolean {
    if (!turn || turn.role !== "assistant") return false

    const hasText = turn.text.trim().length > 0
    const hasFunctionCalls = turn.function_calls.length > 0
    const hasSnippets = (turn.snippets?.length ?? 0) > 0

    return !hasText && !hasFunctionCalls && !hasSnippets && !turn.filter_result && !turn.isFailure
}

/**
 * Filters out thinking-only turns that have subsequent turns after them.
 * Keeps thinking turns if they're the last turn (still actively thinking).
 */
export function filterOutThinkingOnlyTurns(turns: Turn[]): Turn[] {
    return turns.filter((turn, index) => {
        // Keep all turns that have content
        if (turn.role === "user" || turn.text?.length > 0 || turn.function_calls?.length > 0 || turn.filter_result || (turn.snippets?.length ?? 0) > 0 || (turn.process_outputs?.length ?? 0) > 0) {
            return true
        }
        // Keep thinking turns if they're the last turn (still thinking)
        if (turn.isThinking && index === turns.length - 1) {
            return true
        }
        // Remove thinking-only turns that have turns after them
        return false
    })
}
