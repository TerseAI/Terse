import type { TextUnit as TextUnitModel } from "../../turnModel"
import TokenStream from "../TokenStream"

export function TextUnit({ unit, disableAnimation }: { unit: TextUnitModel; disableAnimation?: boolean }) {
    if (!unit.text) return null

    return <TokenStream text={unit.text} disableAnimation={disableAnimation} />
}
