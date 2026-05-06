import { SnippetView } from "../snippets/SnippetView"
import type { SnippetUnit as SnippetUnitModel } from "../turnModel"

export function SnippetUnit({ unit, onMultipleChoiceAnswer }: { unit: SnippetUnitModel; onMultipleChoiceAnswer?: (questionId: string, value: string) => void }) {
    return (
        <div className="ml-1 py-0.5">
            <SnippetView snippet={unit.snippet} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
        </div>
    )
}
