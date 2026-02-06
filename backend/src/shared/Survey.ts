

export type MultipleChoiceQuestion = {
    question: string;
    options: MultipleChoiceOption[];
}

export type MultipleChoiceOption = {
    label: string;
    value: string;
}