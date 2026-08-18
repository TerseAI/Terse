import { useEffect } from "react"
import { Link } from "react-router-dom"

import { ArrowUpRight, CreditCard, RefreshCw } from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"
import { type BalanceSummary, FrontendRoutes, type Plan, isPurchasablePlan } from "terse-types"

import { FetchErrorCard } from "@/components/FetchErrorCard"
import { PageFrame, PageHeader, PageTitle } from "@/components/PageFrame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BackendProvider } from "@/lib/http"
import { invalidateBillingCaches } from "@/modules/billing/api/billingCache"
import { useBillingCatalog } from "@/modules/billing/api/useBillingCatalog"
import { useBillingContext } from "@/modules/billing/api/useBillingContext"
import { useBillingStatus } from "@/modules/billing/api/useBillingStatus"
import { useBillingUsageBuckets } from "@/modules/billing/api/useBillingUsageBuckets"
import { BillingDisabledState } from "@/modules/billing/components/BillingDisabledState"
import { CreditBalanceWidget } from "@/modules/billing/components/CreditBalanceWidget"
import { UsageChart } from "@/modules/billing/components/UsageChart"
import { formatUsd } from "@/modules/billing/utils/billingFormat"
import { getUserTimezone } from "@/utils/timezone"

export default function BillingPage() {
    const timezone = getUserTimezone()
    const { billingEnabled, balance, isLoading: balanceLoading, isError: balanceError } = useBillingContext({ timezone })
    const usageRange = computeUsageRange(balance)
    const usageRangeLabel = balance ? formatBillingPeriodLabel(balance) : null
    const { buckets, isError: bucketsError, mutate: retryBuckets } = useBillingUsageBuckets(usageRange ? { timezone: "UTC", start: usageRange.start, end: usageRange.end } : null)

    const catalogEnabled = billingEnabled !== false
    const { plans, isLoading: catalogLoading, isError: catalogError, mutate: retryCatalog } = useBillingCatalog(catalogEnabled)
    const { status: billingStatus, isLoading: billingStatusLoading } = useBillingStatus()

    const loading = balanceLoading

    const refresh = () => {
        invalidateBillingCaches()
        void retryCatalog()
    }

    // Show the toast once when the page is loaded with a query param,
    // then clear the query param so on page reload we don't see it.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (!params.get("upgraded") && !params.get("topup")) return

        toast.success(params.get("topup") ? "Top-up complete" : "Plan updated")
        window.history.replaceState({}, "", window.location.pathname)
        invalidateBillingCaches()
    }, [])

    const manageBilling = async () => {
        try {
            const { url } = await BackendProvider.createPortalSession()
            window.location.href = url
        } catch {
            toast.error("Couldn't open Stripe portal. Try again.")
        }
    }

    const planKey = balance?.planKey ?? null
    const plan = planKey ? (plans.find(p => p.key === planKey) ?? null) : null
    const showPlanHeaderSkeleton = balanceLoading || (Boolean(balance) && catalogLoading)
    const showError = ((balanceError && !balance) || (catalogError && plans.length === 0)) && !balanceLoading
    const billingDisabled = !balanceLoading && billingEnabled === false
    const scheduledChange = balance ? formatScheduledChange(balance) : null

    return (
        <PageFrame>
            <PageHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <PageTitle>Billing</PageTitle>
                {!billingDisabled && !billingStatusLoading && billingStatus?.canManageBilling && (
                    <Button variant="outline" onClick={manageBilling}>
                        <CreditCard className="size-4" />
                        Manage billing
                    </Button>
                )}
            </PageHeader>
            <div className="flex flex-col gap-6">
                {billingDisabled ? (
                    <BillingDisabledState />
                ) : showError ? (
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
                                    <Button variant="default" className="shrink-0 sm:self-center" asChild>
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
                        </section>

                        <section aria-label="Usage history" className="rounded-lg border border-border bg-card">
                            <div className="flex flex-col gap-1 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-sm font-medium text-foreground">Usage this billing period</h2>
                                </div>
                                {usageRangeLabel && (
                                    <div className="text-xs text-muted-foreground sm:text-right">
                                        {usageRangeLabel} <span className="text-muted-foreground/70">· times shown in UTC</span>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-6">
                                {bucketsError && !buckets ? <FetchErrorCard message="Couldn't load usage history." onRetry={() => void retryBuckets()} /> : <UsageChart buckets={buckets} />}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </PageFrame>
    )
}

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

function formatBillingPeriodLabel(balance: BalanceSummary): string {
    const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    return `${formatter.format(new Date(balance.periodStart))} - ${formatter.format(new Date(balance.periodEnd))}`
}

// Usage chart spans the current billing period so it lines up with the credit
// balance above. The window is capped at today so we don't render empty future
// days for the remainder of the period.
function computeUsageRange(balance: BalanceSummary | null): { start: Date; end: Date } | null {
    if (!balance) return null
    const start = DateTime.fromJSDate(new Date(balance.periodStart)).toUTC()
    const periodEnd = DateTime.fromJSDate(new Date(balance.periodEnd)).toUTC()
    const tomorrow = DateTime.utc().plus({ days: 1 }).startOf("day")
    const end = DateTime.min(periodEnd, tomorrow)
    if (start >= end) return null
    return { start: start.toJSDate(), end: end.toJSDate() }
}
