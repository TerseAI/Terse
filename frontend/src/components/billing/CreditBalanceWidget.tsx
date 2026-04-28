import type { BalanceSummary } from "terse-types"

function formatCredits(value: number) {
    return value.toLocaleString()
}

export function CreditBalanceWidget({ balance }: { balance: BalanceSummary | null }) {
    if (!balance) {
        return <div className="h-32 rounded-lg border bg-card p-5 text-sm text-muted-foreground">Loading credit balance...</div>
    }

    const includedPct = Math.min(100, Math.round((balance.consumedCredits / Math.max(balance.includedCredits, 1)) * 100))
    const hardCapPct = Math.round((balance.hardCap / Math.max(balance.includedCredits, 1)) * 100)
    const capPct = Math.min(100, Math.round((balance.consumedCredits / Math.max(balance.hardCap, 1)) * 100))
    const overIncluded = balance.consumedCredits > balance.includedCredits

    return (
        <div className="rounded-lg border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Credits used this period</p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-semibold tracking-tight text-foreground">{formatCredits(balance.consumedCredits)}</span>
                        <span className="text-sm text-muted-foreground">of {formatCredits(balance.includedCredits)} included</span>
                    </div>
                </div>
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    Hard cap: <span className="font-medium text-foreground">{formatCredits(balance.hardCap)}</span>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${overIncluded ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${includedPct}%` }} />
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-foreground/35" style={{ width: `${capPct}%` }} />
                </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
                {balance.overageMode === "soft"
                    ? `Overage billing starts above your included allowance. Automations pause at ${hardCapPct}% of included credits.`
                    : "Strict mode is on. Automations pause at your included credit limit and no overage is billed."}
            </p>
        </div>
    )
}
