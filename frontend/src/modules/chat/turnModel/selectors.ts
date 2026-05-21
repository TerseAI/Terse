import type { Turn } from "./types"

export function filterOutThinkingOnlyTurns(turns: Turn[]): Turn[] {
    return turns.filter((turn, index) => {
        if (turn.role === "user" || turn.status === "failed" || turn.status === "cancelled") return true

        const hasVisibleUnit = turn.units.some(unit => unit.kind !== "thinking")
        if (hasVisibleUnit) return true

        const hasActiveThinking = turn.units.some(unit => unit.kind === "thinking" && unit.active)
        return hasActiveThinking && index === turns.length - 1
    })
}
