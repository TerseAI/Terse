import type { ChatSnippet } from "terse-types"

import { MultipleChoiceQuestionForm } from "../MultipleChoiceQuestionForm"

export type MultipleChoiceSnippetData = Extract<ChatSnippet, { type: "multiple_choice" }>

export function MultipleChoiceSnippet({ snippet, onMultipleChoiceAnswer }: { snippet: MultipleChoiceSnippetData; onMultipleChoiceAnswer?: (questionId: string, value: string) => void }) {
    return (
        <MultipleChoiceQuestionForm
            questionId={snippet.questionId}
            question={snippet.question}
            options={snippet.options}
            allowMultiple={snippet.allowMultiple}
            selectedValue={snippet.selectedValue}
            onSubmit={value => onMultipleChoiceAnswer?.(snippet.questionId, value)}
        />
    )
}
