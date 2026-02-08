import { useState } from "react"

import { CheckIcon } from "@heroicons/react/24/solid"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { MultipleChoiceOption } from "@/shared/Survey"

export type MultipleChoiceQuestionFormProps = {
    questionId: string
    question: string
    options: MultipleChoiceOption[]
    selectedValue?: string
    onSubmit: (value: string) => void
}

export function MultipleChoiceQuestionForm({ questionId, question, options, selectedValue: selectedValueFromProps, onSubmit }: MultipleChoiceQuestionFormProps) {
    const [localSubmittedValue, setLocalSubmittedValue] = useState<string | null>(null)
    const [writeInValue, setWriteInValue] = useState("")
    const answeredFromProps = selectedValueFromProps != null && selectedValueFromProps !== ""
    const answeredLocally = localSubmittedValue !== null
    const submitted = answeredFromProps || answeredLocally
    const effectiveValue = selectedValueFromProps ?? localSubmittedValue

    const handleOptionClick = (value: string) => {
        if (submitted) return
        setLocalSubmittedValue(value)
        onSubmit(value)
    }

    const handleWriteInSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (submitted) return
        const trimmed = writeInValue.trim()
        if (!trimmed) return
        setLocalSubmittedValue(trimmed)
        onSubmit(trimmed)
    }

    const selectedOption = effectiveValue != null ? options.find(opt => opt.value === effectiveValue) : null
    const displayAnswer = selectedOption ? selectedOption.label : (effectiveValue ?? "")

    // Collapsed state: question + answer only (truncate with hover to read full)
    if (submitted) {
        return (
            <Card className={cn("max-w-[400px] border-primary/20 bg-primary/5 py-2.5 shadow-sm", "rounded-lg border px-3")}>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-muted-foreground line-clamp-3 text-xs leading-tight" title={question}>
                        {question}
                    </p>
                    <p className="text-foreground flex min-w-0 items-center gap-1.5 text-sm font-medium" title={displayAnswer}>
                        <CheckIcon className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">{displayAnswer}</span>
                    </p>
                </div>
            </Card>
        )
    }

    // Expanded state: full form
    return (
        <Card className={cn("max-w-[400px] bg-primary/5 border-primary/20 py-4 shadow-sm", "rounded-lg border")}>
            <CardHeader className="min-w-0 px-4 pb-2 pt-0">
                <CardTitle className="line-clamp-3 text-sm font-semibold leading-tight" title={question}>
                    {question}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
                <div className="flex min-w-0 flex-wrap gap-2">
                    {options.map(opt => (
                        <Button
                            key={opt.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto max-w-full justify-start whitespace-normal py-1.5 text-left"
                            title={opt.label}
                            onClick={() => handleOptionClick(opt.value)}
                        >
                            <span className="line-clamp-2">{opt.label}</span>
                        </Button>
                    ))}
                </div>
                <form onSubmit={handleWriteInSubmit} className="space-y-2">
                    <Label htmlFor={`${questionId}-write-in`} className="text-muted-foreground text-xs">
                        Or write your own answer
                    </Label>
                    <div className="flex gap-2">
                        <Input id={`${questionId}-write-in`} type="text" placeholder="Type your answer..." value={writeInValue} onChange={e => setWriteInValue(e.target.value)} className="flex-1" />
                        <Button type="submit" size="sm" variant="secondary" disabled={!writeInValue.trim()}>
                            Submit
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
