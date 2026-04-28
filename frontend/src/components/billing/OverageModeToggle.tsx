import { useState } from "react"

import type { OverageMode } from "terse-types"

import { Switch } from "@/components/ui/switch"

import { BackendProvider } from "../../services/backend"

export function OverageModeToggle({ mode, onChange }: { mode: OverageMode | null; onChange: (mode: OverageMode) => void }) {
    const [saving, setSaving] = useState(false)

    if (!mode) return null

    const setStrict = async (strict: boolean) => {
        const next = strict ? "strict" : "soft"
        setSaving(true)
        try {
            await BackendProvider.setOverageMode(next)
            onChange(next)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-5">
            <div>
                <p className="text-sm font-medium text-foreground">Strict mode</p>
                <p className="text-sm text-muted-foreground">Pause automations at the included limit instead of billing overage.</p>
            </div>
            <Switch checked={mode === "strict"} disabled={saving} onCheckedChange={setStrict} aria-label="Toggle strict billing mode" />
        </div>
    )
}
