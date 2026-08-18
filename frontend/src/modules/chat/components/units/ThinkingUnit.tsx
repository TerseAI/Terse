import type { ThinkingUnit as ThinkingUnitModel } from "../../turnModel"

export function ThinkingUnit({ unit }: { unit: ThinkingUnitModel }) {
    if (!unit.active) return null

    return (
        <div className="flex items-center gap-2.5 py-1 text-sm text-muted-foreground" role="status" aria-live="polite">
            <span className="flex items-center gap-1" aria-hidden="true">
                {[0, 140, 280].map(delay => (
                    <span key={delay} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />
                ))}
            </span>
            <span>Thinking…</span>
        </div>
    )
}
