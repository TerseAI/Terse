import { Link } from "react-router-dom"

import { ArrowUpRight } from "lucide-react"
import { type BalanceSummary, FrontendRoutes, type Plan, PlanKey } from "terse-types"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCredits } from "@/modules/billing/utils/billingFormat"

export function CreditBalanceWidget({ balance, plan }: { balance: BalanceSummary | null; plan: Plan | null }) {
    if (!balance) {
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

    if (balance.hardCap <= 0) {
        return null
    }

    const { consumedCredits, totalCreditCapacity, hardCap } = balance
    const withinIncluded = consumedCredits <= totalCreditCapacity
    const capPct = Math.floor((consumedCredits / hardCap) * 100)
    const overHardCap = consumedCredits >= hardCap

    const fillClass = setFillClass(balance)

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
            </div>

            {withinIncluded && <p className="mt-2 text-xs text-muted-foreground">{capPct}% of your hard limit</p>}

            {overHardCap && (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
                    <div className="space-y-2 text-muted-foreground">
                        <p className="font-medium text-danger">
                            {plan?.key === PlanKey.FREE
                                ? "You are past your included credits. To get your jobs running again, upgrade to a paid plan or purchase a credit pack."
                                : "You are past your included credits. Purchase a credit pack to get your jobs running again."}
                        </p>
                        <Button variant="default" size="sm" className="group h-8 gap-1" asChild>
                            <Link to={FrontendRoutes.PRICING}>
                                {plan?.key === PlanKey.FREE ? "Plans & top-ups" : "Buy a top-up"}
                                <ArrowUpRight className="size-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function setFillClass(balance: BalanceSummary): string {
    return balance.consumedCredits >= balance.totalCreditCapacity ? "bg-danger" : balance.consumedCredits >= 0.75 * balance.totalCreditCapacity ? "bg-warning" : "bg-accent-secondary"
}

function setCreditsUsedTooltip(balance: BalanceSummary, displayCapacity: number): string {
    return `${formatCredits(balance.consumedCredits)} / ${formatCredits(displayCapacity)} credits used`
}
