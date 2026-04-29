import type { BalanceSummary, Plan } from "terse-types"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCredits, formatUsdPrecise } from "@/utility/billingFormat"

export function CreditBalanceWidget({ balance, plan }: { balance: BalanceSummary | null; plan: Plan | null }) {
    if (!balance) {
        return <div className="h-32 text-sm text-muted-foreground">Loading credit balance...</div>
    }

    const { topUpCredits, consumedCredits, planCredits, totalCreditCapacity, overageMode } = balance
    const planRemaining = Math.max(0, planCredits - consumedCredits)
    const totalUsableRemaining = planRemaining + topUpCredits
    const displayCapacity = totalCreditCapacity
    const hardCapCredits = Math.max(balance.hardCap, displayCapacity)
    const withinIncluded = consumedCredits <= planCredits
    const hasOverageHeadroom = hardCapCredits > planCredits
    const overHardCap = consumedCredits >= hardCapCredits && hasOverageHeadroom
    const atPeriodCap = consumedCredits >= hardCapCredits && hardCapCredits > 0

    const capPct = Math.min(100, Math.round((consumedCredits / Math.max(hardCapCredits, 1)) * 100))

    const overageCredits = Math.max(0, consumedCredits - planCredits)
    const overageRateCents = plan?.overageCentsPerCredit ?? 0
    const overageDollars = (overageCredits * overageRateCents) / 100
    const softMeteredOverage = overageMode === "soft" && overageRateCents > 0

    const fillClass = atPeriodCap || totalUsableRemaining <= 0 ? "bg-danger" : !withinIncluded ? "bg-warning" : capPct >= 90 ? "bg-warning" : "bg-accent-secondary"

    const includedTickPct = hasOverageHeadroom && planCredits < hardCapCredits ? Math.round((planCredits / hardCapCredits) * 100) : null
    const showIncludedTick = !withinIncluded && includedTickPct !== null

    const creditsUsedTooltip = `${formatCredits(consumedCredits)} / ${formatCredits(displayCapacity)} credits used`
    const remainingLabel = totalUsableRemaining > 0 ? `${formatCredits(totalUsableRemaining)} remaining` : "0 remaining"

    return (
        <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm tabular-nums">
                    <span className="font-semibold text-foreground">{formatCredits(consumedCredits)}</span>
                    <span className="text-muted-foreground"> / {formatCredits(displayCapacity)} credits used</span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">{remainingLabel}</p>
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative mt-3 h-3 w-full cursor-default overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-[width] duration-500 ${fillClass}`} style={{ width: `${capPct}%` }} />
                        {showIncludedTick && <div aria-hidden className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${includedTickPct}%` }} />}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">{creditsUsedTooltip}</TooltipContent>
            </Tooltip>

            {withinIncluded ? (
                <p className="mt-2 text-xs text-muted-foreground">{capPct}% of your period cap</p>
            ) : (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
                    <p className="font-medium text-foreground">You are past your included credits</p>
                    {softMeteredOverage ? (
                        <p className="text-muted-foreground">
                            <span className="text-foreground">{formatCredits(overageCredits)}</span> add-on credits this period (~
                            {formatUsdPrecise(overageDollars)} at {formatUsdPrecise(overageRateCents / 100)} / credit).
                        </p>
                    ) : (
                        <p className="text-muted-foreground">
                            {topUpCredits > 0 ? (
                                <>
                                    {" "}
                                    <span className="tabular-nums text-foreground">{formatCredits(topUpCredits)}</span> top-up credits remaining.
                                </>
                            ) : (
                                <> Click here to buy top-ups</>
                            )}
                        </p>
                    )}
                    {softMeteredOverage && topUpCredits > 0 && (
                        <p className="text-muted-foreground">
                            <span className="tabular-nums text-foreground">{formatCredits(topUpCredits)}</span> prepaid top-up credits also available.
                        </p>
                    )}
                    {overHardCap && <p className="font-medium text-danger">Usage cap reached — new runs are blocked until usage resets or you adjust your plan.</p>}
                </div>
            )}
        </div>
    )
}
