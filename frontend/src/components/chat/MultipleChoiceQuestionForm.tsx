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
    allowMultiple?: boolean
    selectedValue?: string
    onSubmit: (value: string) => void
}

/** Separator used to join multiple selected values into a single string */
const MULTI_VALUE_SEPARATOR = ", "

function parseMultiValue(value: string): string[] {
    return value.split(MULTI_VALUE_SEPARATOR).filter(Boolean)
}

function joinMultiValue(values: string[]): string {
    return values.join(MULTI_VALUE_SEPARATOR)
}

export function MultipleChoiceQuestionForm({
    questionId,
    question,
    options,
    allowMultiple = false,
    selectedValue: selectedValueFromProps,
    onSubmit
}: MultipleChoiceQuestionFormProps) {
    const [localSubmittedValue, setLocalSubmittedValue] = useState<string | null>(null)
    const [writeInValue, setWriteInValue] = useState("")
    const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set())

    const answeredFromProps = selectedValueFromProps != null && selectedValueFromProps !== ""
    const answeredLocally = localSubmittedValue !== null
    const submitted = answeredFromProps || answeredLocally
    const effectiveValue = selectedValueFromProps ?? localSubmittedValue

    // --- Single-select handlers ---
    const handleSingleOptionClick = (value: string) => {
        if (submitted) return
        setLocalSubmittedValue(value)
        onSubmit(value)
    }

    // --- Multi-select handlers ---
    const handleToggleOption = (value: string) => {
        if (submitted) return
        setPendingSelections(prev => {
            const next = new Set(prev)
            if (next.has(value)) {
                next.delete(value)
            } else {
                next.add(value)
            }
            return next
        })
    }

    const handleMultiSubmit = () => {
        if (submitted || pendingSelections.size === 0) return
        const selectedValues = options.filter(opt => pendingSelections.has(opt.value)).map(opt => opt.value)
        const joined = joinMultiValue(selectedValues)
        setLocalSubmittedValue(joined)
        onSubmit(joined)
    }

    // --- Write-in (shared) ---
    const handleWriteInSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (submitted) return
        const trimmed = writeInValue.trim()
        if (!trimmed) return
        setLocalSubmittedValue(trimmed)
        onSubmit(trimmed)
    }

    // --- Collapsed display ---
    const getDisplayAnswer = (): string => {
        if (effectiveValue == null) return ""
        if (allowMultiple) {
            const values = parseMultiValue(effectiveValue)
            return (
                values
                    .map(v => {
                        const opt = options.find(o => o.value === v)
                        return opt ? opt.label : v
                    })
                    .join(MULTI_VALUE_SEPARATOR) || effectiveValue
            )
        }
        const selectedOption = options.find(opt => opt.value === effectiveValue)
        return selectedOption ? selectedOption.label : effectiveValue
    }

    // Collapsed state: question + answer only
    if (submitted) {
        const displayAnswer = getDisplayAnswer()
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
                {allowMultiple && (
                    <p className="text-muted-foreground text-xs italic">Select all that apply</p>
                )}
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
                <div className="flex min-w-0 flex-col gap-1.5">
                    {options.map(opt => {
                        if (allowMultiple) {
                            const isSelected = pendingSelections.has(opt.value)
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border bg-background text-foreground hover:bg-muted"
                                    )}
                                    title={opt.label}
                                    onClick={() => handleToggleOption(opt.value)}
                                >
                                    {/* Checkbox indicator — always present to prevent layout shift */}
                                    <span
                                        className={cn(
                                            "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                                        )}
                                    >
                                        {isSelected && <CheckIcon className="size-3" />}
                                    </span>
                                    <span className="line-clamp-2">{opt.label}</span>
                                </button>
                            )
                        }

                        return (
                            <Button
                                key={opt.value}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto max-w-full justify-start whitespace-normal py-1.5 text-left"
                                title={opt.label}
                                onClick={() => handleSingleOptionClick(opt.value)}
                            >
                                <span className="line-clamp-2">{opt.label}</span>
                            </Button>
                        )
                    })}
                </div>

                {allowMultiple && (
                    <Button type="button" size="sm" disabled={pendingSelections.size === 0} onClick={handleMultiSubmit} className="w-full">
                        Confirm{pendingSelections.size > 0 ? ` (${pendingSelections.size} selected)` : ""}
                    </Button>
                )}

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
