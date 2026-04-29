import { useId, useState } from "react"

import { Loader2 } from "lucide-react"
import type { OverageMode, Plan } from "terse-types"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { BackendProvider } from "../../services/backend"

function formatOverageRate(centsPerCredit: number | null | undefined): string {
    if (centsPerCredit == null) return ""
    const dollars = centsPerCredit / 100
    return `$${dollars.toFixed(3)}`
}

const OPTIONS = [
    {
        value: "strict" as const,
        label: "Strict",
        description: (_: Plan | null) => "Pause runs when prepaid credits are exhausted. No overage charges."
    },
    {
        value: "soft" as const,
        label: "Soft",
        description: (plan: Plan | null) => {
            const rate = formatOverageRate(plan?.overageCentsPerCredit)
            return rate ? `Allow overages, billed at ${rate} per credit up to ${plan?.hardCapMultiplier}x plan credits.` : "Allow overages, billed per credit."
        }
    }
]

export function OverageModeToggle({ mode, plan, onChange }: { mode: OverageMode | null; plan: Plan | null; onChange: (mode: OverageMode) => void }) {
    const [savingMode, setSavingMode] = useState<OverageMode | null>(null)
    const groupId = useId()

    if (!mode) return null

    const supportsSoft = !!plan?.overagePriceId
    const handleChange = async (next: string) => {
        const value = next as OverageMode
        if (value === mode) return
        if (value === "soft" && !supportsSoft) return
        setSavingMode(value)
        try {
            await BackendProvider.setOverageMode(value)
            onChange(value)
        } finally {
            setSavingMode(null)
        }
    }

    return (
        <RadioGroup value={mode} onValueChange={handleChange} className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map(option => {
                const id = `${groupId}-${option.value}`
                const disabled = (option.value === "soft" && !supportsSoft) || savingMode !== null
                const selected = mode === option.value
                const saving = savingMode === option.value
                return (
                    <label
                        key={option.value}
                        htmlFor={id}
                        data-state={selected ? "selected" : "unselected"}
                        aria-disabled={disabled}
                        className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground/30 data-[state=selected]:border-foreground data-[state=selected]:bg-muted/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                    >
                        <RadioGroupItem id={id} value={option.value} disabled={disabled} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{option.label}</span>
                                {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label="Saving" />}
                                {option.value === "soft" && !supportsSoft && <span className="text-xs text-muted-foreground">Pro only</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.description(plan)}</p>
                        </div>
                    </label>
                )
            })}
        </RadioGroup>
    )
}
