import type { SnippetUnit as SnippetUnitModel } from "../../turnModel"
import { SnippetView } from "../snippets/SnippetView"

export function SnippetUnit({ unit, onMultipleChoiceAnswer }: { unit: SnippetUnitModel; onMultipleChoiceAnswer?: (questionId: string, value: string) => void }) {
    return (
        <div className="ml-1 py-0.5">
            <SnippetView snippet={unit.snippet} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
        </div>
    )
}
