import { useId } from "react"

import { Loader2 } from "lucide-react"
import type { OverageMode, Plan } from "terse-types"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatUsdPerThousandCredits } from "@/utility/billingFormat"

const OPTIONS = [
    {
        value: "strict" as const,
        label: "Strict",
        description: () => "Pause runs when plan and additional credits are exhausted. No overage charges."
    },
    {
        value: "soft" as const,
        label: "Soft",
        description: (plan: Plan | null) => {
            const c = plan?.overageCentsPerCredit
            return c != null && c > 0
                ? `Allow overages, billed at ${formatUsdPerThousandCredits(c)} per 1,000 credits up to ${plan?.hardCapMultiplier}x plan credits.`
                : "Allow overages at metered rates."
        }
    }
]

export function OverageModeToggle({
    mode,
    plan,
    savingMode = null,
    onChange
}: {
    mode: OverageMode | null
    plan: Plan | null
    savingMode?: OverageMode | null
    onChange: (mode: OverageMode) => void
}) {
    const groupId = useId()

    if (!mode) return null

    const supportsSoft = !!plan?.overagePriceId
    const handleChange = (next: string) => {
        const value = next as OverageMode
        if (value === mode) return
        if (value === "soft" && !supportsSoft) return
        if (savingMode) return
        onChange(value)
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
                            <label key={option.value} htmlFor={id} aria-disabled={disabled} className="flex items-center gap-1.5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
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
