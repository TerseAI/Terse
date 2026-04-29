import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { motion } from "framer-motion"
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { type BalanceSummary, type BillingPeriod, FrontendRoutes, type Plan, type PlanKey, getAllPlans, getAllTopups, isPurchasablePlan } from "terse-types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { POST_LOGIN_REDIRECT_KEY } from "@/constants/storageKeys"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"
import { formatUsd } from "@/utility/billingFormat"

function planTagline(plan: Plan): string {
    if (!isPurchasablePlan(plan.key)) return "For trying things out."
    return "For shipping teams."
}

function planFeatures(plan: Plan): string[] {
    const features: string[] = [
        `${plan.includedCreditsPerMonth.toLocaleString()} credits / month`,
        `${plan.seats ?? 1} ${plan.seats === 1 ? "seat" : "seats"}`,
        `${plan.concurrentRuns} concurrent ${plan.concurrentRuns === 1 ? "run" : "runs"}`
    ]
    return features
}

export default function PricingPage() {
    const { hash } = useLocation()
    const navigate = useNavigate()
    const { user, isLoading: authLoading } = useAuth()
    const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
    const [loadingTopupCredits, setLoadingTopupCredits] = useState<number | null>(null)
    const [balance, setBalance] = useState<BalanceSummary | null>(null)
    const [plansReady, setPlansReady] = useState(false)
    const [period, setPeriod] = useState<BillingPeriod>("yearly")

    useEffect(() => {
        if (!hash) return
        const id = hash.slice(1)
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }))
    }, [hash])

    useEffect(() => {
        if (authLoading) {
            setPlansReady(false)
            return
        }
        if (!user) {
            setBalance(null)
            setPlansReady(true)
            return
        }
        setPlansReady(false)
        let cancelled = false
        void BackendProvider.getBalance()
            .then(b => {
                if (!cancelled) setBalance(b)
            })
            .catch(() => {
                if (!cancelled) setBalance(null)
            })
            .finally(() => {
                if (cancelled) return
                setPlansReady(true)
            })
        return () => {
            cancelled = true
        }
    }, [authLoading, user])

    const plans = useMemo(() => getAllPlans(), [])
    const currentPlanKey = balance?.planKey ?? null
    const currentPeriod = balance?.billingPeriod ?? null
    const showSkeleton = authLoading || !plansReady

    const annualSavingsDollars = useMemo(() => {
        const purchasable = plans.find(p => isPurchasablePlan(p.key) && p.priceInUsdMonthly && p.priceInUsdMonthlyAnnual)
        if (!purchasable) return null
        const monthly = purchasable.priceInUsdMonthly!
        const annual = purchasable.priceInUsdMonthlyAnnual!
        const yearly = (monthly - annual) * 12
        return yearly > 0 ? formatUsd(yearly) : null
    }, [plans])

    const requireUser = () => {
        if (user) return true
        localStorage.setItem(POST_LOGIN_REDIRECT_KEY, FrontendRoutes.PRICING)
        BackendProvider.loginRedirect()
        return false
    }

    const selectPlan = async (planKey: PlanKey) => {
        if (!requireUser()) return

        if (planKey === "free") {
            if (currentPlanKey && currentPlanKey !== "free") {
                setLoadingPlan(planKey)
                try {
                    await BackendProvider.changeBillingSubscription({ kind: "cancel_to_free" })
                    toast.success("Downgrade scheduled for the end of your billing period.")
                    navigate(FrontendRoutes.BILLING)
                } finally {
                    setLoadingPlan(null)
                }
                return
            }
            navigate(FrontendRoutes.APP)
            return
        }

        setLoadingPlan(planKey)
        try {
            if (currentPlanKey && currentPlanKey !== "free") {
                await BackendProvider.changeBillingSubscription({ kind: "change_period", planKey, period })
                toast.success("Plan change scheduled for the end of your billing period.")
                navigate(FrontendRoutes.BILLING)
                return
            }
            const { url } = await BackendProvider.createCheckoutForPlan(planKey, period)
            window.location.href = url
        } finally {
            setLoadingPlan(null)
        }
    }

    const buyTopup = async (packCredits: number) => {
        if (!requireUser()) return
        if (balance && !balance.canBuyTopups) {
            toast.error("Top-ups require an active paid plan.")
            return
        }
        setLoadingTopupCredits(packCredits)
        try {
            const { url } = await BackendProvider.createCheckoutForTopup(packCredits)
            window.location.href = url
        } finally {
            setLoadingTopupCredits(null)
        }
    }

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
            return
        }
        navigate(FrontendRoutes.APP)
    }

    return (
        <div className="min-h-full overflow-auto bg-background px-4 py-12 text-foreground md:py-16">
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
                <header className="max-w-2xl">
                    <Button variant="ghost" size="sm" className="-ml-2 mb-5 text-muted-foreground hover:text-foreground" onClick={goBack}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Pay for what you actually use. Switch or cancel anytime.</p>
                </header>

                <section id="plans" className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                        <PeriodToggle period={period} onChange={setPeriod} />
                        {annualSavingsDollars && period === "yearly" && <span className="text-xs font-medium text-success">Saving {annualSavingsDollars}/yr</span>}
                    </div>

                    {showSkeleton ? (
                        <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading plans">
                            <PlanCardSkeleton />
                            <PlanCardSkeleton />
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {plans.map(plan => (
                                <PlanCard
                                    key={plan.key}
                                    plan={plan}
                                    period={period}
                                    currentPlanKey={currentPlanKey}
                                    currentPeriod={currentPeriod}
                                    isRecommended={isPurchasablePlan(plan.key)}
                                    loading={loadingPlan === plan.key}
                                    onSelect={() => void selectPlan(plan.key)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section id="topups" className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Need more credits?</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Top-ups apply to metered usage and never expire.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {getAllTopups().map(topup => (
                            <article key={topup.credits} className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center">
                                <div>
                                    <div className="text-lg font-semibold tabular-nums">{topup.credits.toLocaleString()} credits</div>
                                    <p className="mt-0.5 text-sm text-muted-foreground">One-time, never expires.</p>
                                </div>
                                <Button
                                    className="shrink-0 sm:min-w-[180px]"
                                    disabled={!!user ? !balance?.canBuyTopups || loadingTopupCredits === topup.credits : loadingTopupCredits === topup.credits}
                                    onClick={() => void buyTopup(topup.credits)}
                                >
                                    {loadingTopupCredits === topup.credits ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Opening checkout
                                        </>
                                    ) : (
                                        <>
                                            Buy {topup.credits.toLocaleString()} credits for ${topup.priceInUsd}
                                        </>
                                    )}
                                </Button>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    )
}

function PeriodToggle({ period, onChange }: { period: BillingPeriod; onChange: (next: BillingPeriod) => void }) {
    const options: { value: BillingPeriod; label: string }[] = [
        { value: "monthly", label: "Monthly" },
        { value: "yearly", label: "Annual" }
    ]
    return (
        <div role="radiogroup" aria-label="Billing period" className="relative inline-flex rounded-full border border-border bg-muted p-1 text-sm">
            {options.map(option => {
                const active = option.value === period
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={`relative z-10 rounded-full px-4 py-1 font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        {active && (
                            <motion.span
                                layoutId="period-toggle-active"
                                className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm"
                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                            />
                        )}
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

function PlanCard({
    plan,
    period,
    currentPlanKey,
    currentPeriod,
    isRecommended,
    loading,
    onSelect
}: {
    plan: Plan
    period: BillingPeriod
    currentPlanKey: PlanKey | null
    currentPeriod: BillingPeriod | null
    isRecommended: boolean
    loading: boolean
    onSelect: () => void
}) {
    const purchasable = isPurchasablePlan(plan.key)
    const isCurrentPlan = currentPlanKey === plan.key
    const isExactCurrent = isCurrentPlan && (!purchasable || currentPeriod === period)
    const monthlyPrice = plan.priceInUsdMonthly ?? 0
    const annualPrice = plan.priceInUsdMonthlyAnnual ?? 0
    const displayPrice = period === "yearly" && annualPrice > 0 ? annualPrice : monthlyPrice
    const features = planFeatures(plan)
    const tagline = planTagline(plan)

    const ctaLabel = isExactCurrent
        ? "Current plan"
        : isCurrentPlan && purchasable
          ? `Switch to ${period === "yearly" ? "annual" : "monthly"}`
          : plan.key === "free" && currentPlanKey && currentPlanKey !== "free"
            ? "Downgrade to Free"
            : purchasable
              ? `Choose ${plan.name}`
              : "Get started"
    const ctaVariant: "default" | "outline" = isRecommended && !isExactCurrent ? "default" : "outline"
    const cardEmphasis = isRecommended ? "border-foreground/40" : "border-border"

    return (
        <article className={`relative flex min-h-[360px] flex-col rounded-lg border bg-card p-6 ${cardEmphasis}`}>
            {isExactCurrent ? (
                <Badge variant="secondary" className="absolute right-4 top-4">
                    Current plan
                </Badge>
            ) : isRecommended ? (
                <Badge className="absolute right-4 top-4 bg-accent-primary text-white">Most popular</Badge>
            ) : null}

            <div>
                <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{tagline}</p>
            </div>

            <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{purchasable ? `$${displayPrice.toFixed(0)}` : "$0"}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
            </div>
            {purchasable && period === "yearly" && annualPrice > 0 && <p className="mt-1 text-xs text-muted-foreground">Billed annually at ${(annualPrice * 12).toFixed(0)}.</p>}
            {purchasable && period === "monthly" && <p className="mt-1 text-xs text-muted-foreground">${annualPrice.toFixed(0)}/mo billed annually.</p>}

            <ul className="mt-6 space-y-2.5">
                {features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-foreground/60" aria-hidden />
                        <span className="text-foreground">{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto pt-6">
                <Button className="w-full" variant={ctaVariant} disabled={loading || isExactCurrent} onClick={onSelect}>
                    {loading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            Opening checkout
                        </>
                    ) : (
                        ctaLabel
                    )}
                </Button>
            </div>
        </article>
    )
}

function PlanCardSkeleton() {
    return (
        <div className="flex min-h-[360px] flex-col rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-2 h-4 w-32" />
            <Skeleton className="mt-5 h-9 w-28" />
            <div className="mt-6 space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-3/4" />
                ))}
            </div>
            <Skeleton className="mt-auto h-10 w-full" />
        </div>
    )
}
