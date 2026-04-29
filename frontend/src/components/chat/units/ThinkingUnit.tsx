import type { ThinkingUnit as ThinkingUnitModel } from "../turnModel"

export function ThinkingUnit({ unit }: { unit: ThinkingUnitModel }) {
    if (!unit.active) return null

    return (
        <div className="text-foreground text-md py-2 rounded-8xl">
            <div className="prose prose-invert">
                <div className="flex items-center gap-2 text-muted-foreground italic">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Thinking...</span>
                </div>
            </div>
        </div>
    )
}
