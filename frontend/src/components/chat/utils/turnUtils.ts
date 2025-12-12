import { Turn } from '../Turn';

/**
 * Filters out thinking-only turns that have subsequent turns after them.
 * Keeps thinking turns if they're the last turn (still actively thinking).
 */
export function filterOutThinkingOnlyTurns(turns: Turn[]): Turn[] {
    return turns.filter((turn, index) => {
        // Keep all turns that have content
        if (turn.role === 'user' || turn.text?.length > 0 || turn.function_calls?.length > 0 || turn.filter_result) {
            return true;
        }
        // Keep thinking turns if they're the last turn (still thinking)
        if (turn.isThinking && index === turns.length - 1) {
            return true;
        }
        // Remove thinking-only turns that have turns after them
        return false;
    });
}