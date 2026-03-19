export type MultipleChoiceQuestion = {
    question: string
    options: MultipleChoiceOption[]
    allowMultiple?: boolean
}

export type MultipleChoiceOption = {
    label: string
    value: string
}
