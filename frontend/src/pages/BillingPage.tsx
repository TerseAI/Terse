import { useEffect } from "react"
import { Link } from "react-router-dom"

import { ArrowUpRight, CreditCard, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { type BalanceSummary, FrontendRoutes, type OverageMode, type Plan, isPurchasablePlan } from "terse-types"

import { CreditBalanceWidget } from "@/components/billing/CreditBalanceWidget"
import { OverageModeToggle } from "@/components/billing/OverageModeToggle"
import { UsageChart } from "@/components/billing/UsageChart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { invalidateBillingCaches } from "@/hooks/api/billingCache"
import { useBillingCatalog } from "@/hooks/api/useBillingCatalog"
import { useBillingContext } from "@/hooks/api/useBillingContext"
import { BackendProvider } from "@/services/backend"
import { formatUsd } from "@/utility/billingFormat"

const periodFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

function formatNextCharge(balance: BalanceSummary, plan: Plan | null): string {
    const endDate = periodFormatter.format(new Date(balance.periodEnd))
    if (!plan || !isPurchasablePlan(plan)) return `Resets after ${endDate}`

    const change = balance.scheduledChange
    if (change?.kind === "cancel_to_free") return `Plan ends ${endDate}`

    const effectivePeriod = change?.kind === "change_period" ? change.period : balance.billingPeriod
    if (!plan || !effectivePeriod) return `Renews ${endDate}`

    const amount = effectivePeriod === "monthly" ? plan.priceInUsdMonthly : plan.priceInUsdMonthlyAnnual !== null ? plan.priceInUsdMonthlyAnnual * 12 : null
    if (amount === null) return `Renews ${endDate}`
    const label = effectivePeriod === "yearly" ? "Annual renewal" : "Next charge"
    return `${label}: ${formatUsd(amount)} on ${endDate}`
}

function formatScheduledChange(balance: BalanceSummary): string | null {
    if (!balance.scheduledChange) return null
    const effectiveAt = periodFormatter.format(new Date(balance.scheduledChange.effectiveAt))
    if (balance.scheduledChange.kind === "cancel_to_free") {
        return `Downgrade to Free scheduled for ${effectiveAt}.`
    }
    return `Switch to ${balance.scheduledChange.period === "yearly" ? "annual" : "monthly"} billing scheduled for ${effectiveAt}.`
}

export default function BillingPage() {
    const { balance, buckets, isLoading: balanceLoading, isError: balanceError, mutate: mutateBalance } = useBillingContext(true)
    const { plans, isLoading: catalogLoading, isError: catalogError, mutate: retryCatalog } = useBillingCatalog()

    const loading = balanceLoading

    const refresh = () => {
        invalidateBillingCaches()
        void retryCatalog()
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (!params.get("upgraded") && !params.get("topup")) return

        toast.success(params.get("topup") ? "Top-up complete" : "Plan updated")
        window.history.replaceState({}, "", window.location.pathname)
        let attempts = 0
        const interval = window.setInterval(() => {
            attempts += 1
            invalidateBillingCaches()
            if (attempts >= 5) window.clearInterval(interval)
        }, 2000)
        return () => window.clearInterval(interval)
    }, [])

    const manageBilling = async () => {
        try {
            const { url } = await BackendProvider.createPortalSession()
            window.location.href = url
        } catch {
            toast.error("Couldn't open Stripe portal. Try again.")
        }
    }

    const updateMode = (mode: OverageMode) => {
        void mutateBalance(current => (current ? { ...current, balance: { ...current.balance, overageMode: mode } } : current), { revalidate: false })
    }

    const planKey = balance?.planKey ?? null
    const plan = planKey ? (plans.find(p => p.key === planKey) ?? null) : null
    const showPlanHeaderSkeleton = balanceLoading || (Boolean(balance) && catalogLoading)
    const showError = ((balanceError && !balance) || (catalogError && plans.length === 0)) && !balanceLoading
    const scheduledChange = balance ? formatScheduledChange(balance) : null

    return (
        <div className="flex h-full min-h-0 flex-col overflow-auto bg-background p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing</h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track your credit usage, change plans, and manage payment details.</p>
                    </div>
                    <Button variant="outline" onClick={manageBilling}>
                        <CreditCard className="size-4" />
                        Manage billing
                    </Button>
                </header>

                {showError ? (
                    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
                        <div>
                            <p className="text-sm font-medium text-foreground">Couldn't load billing details.</p>
                            <p className="mt-1 text-sm text-muted-foreground">Check your connection or try again in a moment.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                            Retry
                        </Button>
                    </div>
                ) : (
                    <>
                        <section aria-label="Current period" className="overflow-hidden rounded-lg border border-border bg-card">
                            <div className="border-b border-border bg-muted/30 px-6 py-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current plan</p>
                                        {showPlanHeaderSkeleton ? (
                                            <div className="space-y-2" aria-busy="true" aria-label="Loading plan details">
                                                <Skeleton className="h-8 w-36" />
                                                <Skeleton className="h-4 w-64 max-w-full" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="text-2xl font-semibold tracking-tight text-foreground">{plan ? plan.name : "—"}</span>
                                                    {balance?.billingPeriod && (
                                                        <Badge variant="outline" className="shrink-0 text-xs font-medium capitalize">
                                                            {balance.billingPeriod}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {balance && plan && <p className="text-sm tabular-nums text-muted-foreground">{formatNextCharge(balance, plan)}</p>}
                                            </>
                                        )}
                                    </div>
                                    <Button variant="secondary" className="shrink-0 sm:self-center" asChild>
                                        <Link to={FrontendRoutes.PRICING}>
                                            Change plan
                                            <ArrowUpRight className="size-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                            <div className="px-6 py-6">
                                {scheduledChange && !showPlanHeaderSkeleton && (
                                    <div
                                        className={`mb-4 rounded-md border px-3 py-2 text-sm text-foreground ${
                                            balance?.scheduledChange?.kind === "cancel_to_free" ? "border-warning/30 bg-warning/10" : "border-border bg-muted"
                                        }`}
                                    >
                                        {scheduledChange}
                                    </div>
                                )}
                                {showPlanHeaderSkeleton ? (
                                    <div className="space-y-3 py-1" aria-busy="true" aria-label="Loading usage summary">
                                        <Skeleton className="h-4 w-full max-w-md" />
                                        <Skeleton className="h-3 w-full rounded-full" />
                                        <Skeleton className="h-3 w-2/3" />
                                    </div>
                                ) : (
                                    <CreditBalanceWidget balance={balance} plan={plan} />
                                )}
                            </div>

                            {balance && plan?.overagePriceId && !showPlanHeaderSkeleton && (
                                <div className="border-t border-border px-6 py-3">
                                    <OverageModeToggle mode={balance.overageMode} plan={plan} onChange={updateMode} />
                                </div>
                            )}
                        </section>

                        <section aria-label="Usage history" className="rounded-lg border border-border bg-card">
                            <div className="flex items-center justify-between border-b border-border px-6 py-4">
                                <div>
                                    <h2 className="text-sm font-medium text-foreground">Last 30 days</h2>
                                </div>
                            </div>
                            <div className="px-6 py-6">
                                <UsageChart buckets={buckets} />
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}
