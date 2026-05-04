import type { ChatSnippet } from "terse-types"

import { ButtonSnippet } from "./ButtonSnippet"
import { ImageSnippet } from "./ImageSnippet"
import { IntegrationPromptSnippet } from "./IntegrationPromptSnippet"
import { MultipleChoiceSnippet } from "./MultipleChoiceSnippet"
import { NavigateSnippet } from "./NavigateSnippet"
import { WebhookFailureSnippet } from "./WebhookFailureSnippet"

export function SnippetView({ snippet, onMultipleChoiceAnswer }: { snippet: ChatSnippet; onMultipleChoiceAnswer?: (questionId: string, value: string) => void }) {
    switch (snippet.type) {
        case "navigate":
            return <NavigateSnippet snippet={snippet} />
        case "button":
            return <ButtonSnippet snippet={snippet} />
        case "integration_prompt":
            return <IntegrationPromptSnippet snippet={snippet} />
        case "multiple_choice":
            return <MultipleChoiceSnippet snippet={snippet} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
        case "image":
            return <ImageSnippet snippet={snippet} />
        case "webhook_failure":
            return <WebhookFailureSnippet snippet={snippet} />
        default: {
            const _exhaustive: never = snippet
            void _exhaustive
            return null
        }
    }
}
