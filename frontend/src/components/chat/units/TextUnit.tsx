import TokenStream from "../TokenStream"
import type { TextUnit as TextUnitModel } from "../turnModel"

export function TextUnit({ unit, disableAnimation, onComplete }: { unit: TextUnitModel; disableAnimation?: boolean; onComplete?: () => void }) {
    if (!unit.text) return null

    return (
        <div className="text-foreground text-md py-2 rounded-8xl select-text">
            <div className="prose prose-invert select-text">
                <TokenStream text={unit.text} disableAnimation={disableAnimation} onComplete={onComplete} />
            </div>
        </div>
    )
}
