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

    const currentOption = OPTIONS.find(o => o.value === mode)
    const currentDescription = currentOption?.description(plan)

    return (
        <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">When over limit:</span>
                <RadioGroup value={mode} onValueChange={handleChange} className="flex items-center gap-4">
                    {OPTIONS.map(option => {
                        const id = `${groupId}-${option.value}`
                        const disabled = (option.value === "soft" && !supportsSoft) || savingMode !== null
                        const saving = savingMode === option.value
                        return (
                            <label
                                key={option.value}
                                htmlFor={id}
                                aria-disabled={disabled}
                                className="flex items-center gap-1.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                            >
                                <RadioGroupItem id={id} value={option.value} disabled={disabled} />
                                <span className="text-foreground">{option.label}</span>
                                {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label="Saving" />}
                                {option.value === "soft" && !supportsSoft && <span className="text-xs text-muted-foreground">(Pro)</span>}
                            </label>
                        )
                    })}
                </RadioGroup>
            </div>
            {currentDescription && <p className="mt-1.5 text-xs text-muted-foreground">{currentDescription}</p>}
        </div>
    )
}
