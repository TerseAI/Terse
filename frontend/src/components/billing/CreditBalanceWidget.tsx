import { Link } from "react-router-dom"

import { ArrowUpRight } from "lucide-react"
import { type BalanceSummary, FrontendRoutes, type Plan, PlanKey } from "terse-types"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCredits } from "@/utility/billingFormat"

export function CreditBalanceWidget({ balance, plan, isLoading = false }: { balance: BalanceSummary | null; plan: Plan | null; isLoading?: boolean }) {
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

    const { consumedCredits, totalCreditCapacity, hardCap } = balance
    const withinIncluded = consumedCredits <= totalCreditCapacity
    const capPct = Math.floor((consumedCredits / hardCap) * 100)
    const overHardCap = consumedCredits >= hardCap

    // How we fill this shit
    const fillClass = setFillClass(balance)

    // Where should we show the tick?
    const includedTickPct = setIncludedTickPct(balance)
    // Should we show the tick?
    const showIncludedTick = setShowIncludedTick(balance)

    // Text to show
    const creditsUsedTooltip = setCreditsUsedTooltip(balance, hardCap)

    return (
        <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm tabular-nums">
                    <span className="font-semibold text-foreground">{formatCredits(consumedCredits)}</span>
                    <span className="text-muted-foreground"> / {formatCredits(hardCap)} credits used</span>
                </p>
            </div>

            <div className="relative mt-3 h-3 w-full">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="h-full w-full cursor-default overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${fillClass}`} style={{ width: `${capPct}%` }} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">{creditsUsedTooltip}</TooltipContent>
                </Tooltip>
                {showIncludedTick && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                role="presentation"
                                aria-label={`Soft limit: ${formatCredits(balance.totalCreditCapacity)} credits`}
                                className="absolute inset-y-0 w-2 -translate-x-1/2 cursor-help"
                                style={{ left: `${includedTickPct}%` }}
                            >
                                <div aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/40" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">Soft limit: {formatCredits(balance.totalCreditCapacity)} credits</TooltipContent>
                    </Tooltip>
                )}
            </div>

            {withinIncluded ? (
                <p className="mt-2 text-xs text-muted-foreground">{capPct}% of your hard limit</p>
            ) : (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
                    <div className="space-y-2 text-muted-foreground">
                        {consumedCredits > 0 ? (
                            <p>
                                <span className="tabular-nums text-foreground">{formatCredits(consumedCredits)}</span> additional credits remaining.
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
                    {overHardCap && <p className="font-medium text-danger">Usage cap reached — new runs are blocked until usage resets or you adjust your plan.</p>}
                </div>
            )}
        </div>
    )
}

function setFillClass(balance: BalanceSummary): string {
    const overageMode = balance.overageMode

    switch (overageMode) {
        case "soft":
            return balance.consumedCredits >= balance.hardCap ? "bg-danger" : balance.consumedCredits >= balance.totalCreditCapacity ? "bg-warning" : "bg-accent-secondary"
        case "strict":
            return balance.consumedCredits >= balance.totalCreditCapacity ? "bg-danger" : balance.consumedCredits >= 0.75 * balance.totalCreditCapacity ? "bg-warning" : "bg-accent-secondary"
    }
    return "bg-danger"
}

function setIncludedTickPct(balance: BalanceSummary): number {
    return balance.overageMode === "soft" ? Math.floor((balance.totalCreditCapacity / balance.hardCap) * 100) : 0
}

function setShowIncludedTick(balance: BalanceSummary): boolean {
    return balance.overageMode === "soft"
}

function setCreditsUsedTooltip(balance: BalanceSummary, displayCapacity: number): string {
    return `${formatCredits(balance.consumedCredits)} / ${formatCredits(displayCapacity)} credits used`
}
