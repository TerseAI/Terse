import { Link } from "react-router-dom"

import { ArrowUpRight } from "lucide-react"
import { type BalanceSummary, FrontendRoutes, type Plan, PlanKey } from "terse-types"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCredits, formatUsdPerThousandCredits, formatUsdPrecise } from "@/utility/billingFormat"

export function CreditBalanceWidget({
    balance,
    plan,
    isLoading = false
}: {
    balance: BalanceSummary | null
    plan: Plan | null
    isLoading?: boolean
}) {
    if (!balance || isLoading) {
        return (
            <div aria-busy="true" aria-live="polite" role="status">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Skeleton className="h-5 w-48 max-w-full" />
                    <span className="text-xs text-muted-foreground">{balance ? "Updating credit balance..." : "Loading credit balance..."}</span>
                </div>
                <Skeleton className="mt-3 h-3 w-full rounded-full" />
                <Skeleton className="mt-2 h-4 w-36" />
            </div>
        )
    }

    const { topUpCredits, consumedCredits, planCredits, totalCreditCapacity, overageMode } = balance
    const displayCapacity = Math.max(Math.floor(balance.hardCap), Math.floor(totalCreditCapacity))
    const displayedConsumedCredits = Math.min(Math.floor(consumedCredits), displayCapacity)
    const displayedPlanCredits = Math.floor(planCredits)
    const displayedTopUpCredits = Math.floor(topUpCredits)
    const totalUsableRemaining = Math.max(0, displayCapacity - displayedConsumedCredits)
    const hardCapCredits = displayCapacity
    const withinIncluded = consumedCredits <= planCredits
    const hasOverageHeadroom = hardCapCredits > planCredits
    const overHardCap = consumedCredits >= hardCapCredits && hasOverageHeadroom
    const atPeriodCap = displayedConsumedCredits >= hardCapCredits && hardCapCredits > 0

    const capPct = Math.min(100, Math.floor((displayedConsumedCredits / Math.max(hardCapCredits, 1)) * 100))

    const overageCredits = Math.max(0, displayedConsumedCredits - displayedPlanCredits)
    const overageRateCents = plan?.overageCentsPerCredit ?? 0
    const overageDollars = (overageCredits * overageRateCents) / 100
    const softMeteredOverage = overageMode === "soft" && overageRateCents > 0

    const fillClass = atPeriodCap || totalUsableRemaining <= 0 ? "bg-danger" : !withinIncluded ? "bg-warning" : capPct >= 90 ? "bg-warning" : "bg-accent-secondary"

    const includedTickPct = hasOverageHeadroom && displayedPlanCredits < hardCapCredits ? Math.floor((displayedPlanCredits / hardCapCredits) * 100) : null
    const showIncludedTick = !withinIncluded && includedTickPct !== null

    const creditsUsedTooltip = `${formatCredits(displayedConsumedCredits)} / ${formatCredits(displayCapacity)} credits used`
    const remainingLabel = totalUsableRemaining > 0 ? `${formatCredits(totalUsableRemaining)} remaining` : "0 remaining"

    return (
        <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm tabular-nums">
                    <span className="font-semibold text-foreground">{formatCredits(displayedConsumedCredits)}</span>
                    <span className="text-muted-foreground"> / {formatCredits(displayCapacity)} credits used</span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">{remainingLabel}</p>
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative mt-3 h-3 w-full cursor-default overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${fillClass}`} style={{ width: `${capPct}%` }} />
                        {showIncludedTick && <div aria-hidden className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${includedTickPct}%` }} />}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">{creditsUsedTooltip}</TooltipContent>
            </Tooltip>

            {withinIncluded ? (
                <p className="mt-2 text-xs text-muted-foreground">{capPct}% of your period cap</p>
            ) : (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
                    {softMeteredOverage ? (
                        <p className="text-muted-foreground">
                            <span className="text-foreground">{formatCredits(overageCredits)}</span> add-on credits this period (~
                            {formatUsdPrecise(overageDollars)} at {formatUsdPerThousandCredits(overageRateCents)} per 1,000 credits).
                        </p>
                    ) : (
                        <div className="space-y-2 text-muted-foreground">
                            {topUpCredits > 0 ? (
                                <p>
                                    <span className="tabular-nums text-foreground">{formatCredits(displayedTopUpCredits)}</span> additional credits remaining.
                                </p>
                            ) : (
                                <>
                                    <p className="font-medium text-foreground">
                                        {plan?.key === PlanKey.FREE
                                            ? "You are past your included credits. Buy a top-up or upgrade to Pro for soft overages."
                                            : "You are past your included credits. Purchase a credit pack to add credits."}
                                    </p>
                                    <Button variant="default" size="sm" className="group h-8 gap-1" asChild>
                                        <Link to={FrontendRoutes.PRICING}>
                                            {plan?.key === PlanKey.FREE ? "Plans & top-ups" : "Buy a top-up"}
                                            <ArrowUpRight className="size-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                    {softMeteredOverage && topUpCredits > 0 && (
                        <p className="text-muted-foreground">
                            <span className="tabular-nums text-foreground">{formatCredits(displayedTopUpCredits)}</span> additional credits also available.
                        </p>
                    )}
                    {overHardCap && <p className="font-medium text-danger">Usage cap reached — new runs are blocked until usage resets or you adjust your plan.</p>}
                </div>
            )}
        </div>
    )
}
