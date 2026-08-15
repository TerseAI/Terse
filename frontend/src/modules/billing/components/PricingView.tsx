import { type ComponentProps, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { motion } from "framer-motion"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { type BalanceSummary, type BillingPeriod, FrontendRoutes, type Plan, PlanKey, TimePeriods, isPurchasablePlan } from "terse-types"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { POST_LOGIN_REDIRECT_KEY } from "@/constants/storageKeys"
import { BackendProvider } from "@/lib/http"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { invalidateBillingCaches } from "@/modules/billing/api/billingCache"
import { useBillingCatalog } from "@/modules/billing/api/useBillingCatalog"
import { useBillingContext } from "@/modules/billing/api/useBillingContext"
import { formatCredits, formatUsd } from "@/modules/billing/utils/billingFormat"

export default function PricingPage() {
    const navigate = useNavigate()
    const { user, isLoading: authLoading } = useAuth()
    const { balance, isLoading: balanceLoading } = useBillingContext()
    const { plans, topUps, isLoading: catalogLoading, isError: catalogError, mutate: retryCatalog } = useBillingCatalog()
    const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
    const [loadingTopupCredits, setLoadingTopupCredits] = useState<number | null>(null)
    const [period, setPeriod] = useState<TimePeriods>(TimePeriods.YEARLY)
    const [confirmDowngradeOpen, setConfirmDowngradeOpen] = useState(false)

    const currentPlanKey = balance?.planKey ?? null
    const currentPeriod = balance?.billingPeriod ?? null
    const showPlanGridSkeleton = authLoading || catalogLoading || balanceLoading

    const annualSavingsYearly = getAnnualSavingsYearly(plans)

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
                setConfirmDowngradeOpen(true)
                return
            }
            navigate(FrontendRoutes.APP)
            return
        }

        setLoadingPlan(planKey)
        try {
            if (currentPlanKey && currentPlanKey !== "free") {
                await BackendProvider.changeBillingSubscription({ kind: "change_period", planKey, period })
                invalidateBillingCaches()
                toast.success("Plan change scheduled for the end of your billing period.")
                navigate(FrontendRoutes.BILLING)
                return
            }
            const { url } = await BackendProvider.createCheckoutForPlan(planKey, period)
            window.location.href = url
        } catch {
            toast.error("Couldn't update your plan. Try again.")
        } finally {
            setLoadingPlan(null)
        }
    }

    const confirmDowngradeToFree = async () => {
        setConfirmDowngradeOpen(false)
        setLoadingPlan(PlanKey.FREE)
        try {
            await BackendProvider.changeBillingSubscription({ kind: "cancel_to_free" })
            invalidateBillingCaches()
            toast.success("Downgrade scheduled for the end of your billing period.")
            navigate(FrontendRoutes.BILLING)
        } catch {
            toast.error("Couldn't schedule the downgrade. Try again.")
        } finally {
            setLoadingPlan(null)
        }
    }

    const buyTopup = async (packCredits: number) => {
        if (!requireUser()) return
        setLoadingTopupCredits(packCredits)
        try {
            const { url } = await BackendProvider.createCheckoutForTopup(packCredits)
            window.location.href = url
        } catch {
            toast.error("Couldn't open top-up checkout. Try again.")
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

    const showTopups = !authLoading && !catalogLoading && !catalogError && topUps.length > 0

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (!params.get("topup")) return

        toast.success("Top-up complete")
        invalidateBillingCaches()
        window.history.replaceState({}, "", window.location.pathname)
    }, [])

    const currentPlan = currentPlanKey ? (plans.find(p => p.key === currentPlanKey) ?? null) : null
    const freePlan = plans.find(p => p.key === PlanKey.FREE) ?? null
    const downgradeDate = balance?.periodEnd ? dateFormatter.format(new Date(balance.periodEnd)) : null
    const isDowngrading = loadingPlan === PlanKey.FREE

    return (
        <div className="min-h-full overflow-auto bg-background px-4 py-12 text-foreground md:py-16">
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-10">
                <header>
                    <Button variant="ghost" size="sm" className="-ml-2 mb-5 text-muted-foreground hover:text-foreground" onClick={goBack}>
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">Choose a plan, add credits when you need them, or keep using Free.</p>
                </header>

                <section id="plans" className="space-y-5">
                    <PeriodToggle period={period} onChange={setPeriod} annualSavingsYearly={annualSavingsYearly} />

                    {showPlanGridSkeleton ? (
                        <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading plans">
                            <PlanCardSkeleton />
                            <PlanCardSkeleton />
                        </div>
                    ) : catalogError ? (
                        <CatalogErrorCard onRetry={() => void retryCatalog()} />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {plans.map(plan => (
                                <PlanCard
                                    key={plan.key}
                                    plan={plan}
                                    period={period}
                                    currentPlanKey={currentPlanKey}
                                    currentPeriod={currentPeriod}
                                    scheduledNote={formatScheduledNote(balance, plan)}
                                    loading={loadingPlan === plan.key}
                                    onSelect={() => void selectPlan(plan.key)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {showTopups && (
                    <section id="topups" className="space-y-3">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Need more this month?</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Top-ups add credits to any plan and never expire.</p>
                        </div>
                        {topUps.map(topup => (
                            <article key={topup.credits} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
                                <div className="min-w-0">
                                    <div className="text-base font-medium tabular-nums">Top up {topup.credits.toLocaleString()} credits</div>
                                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">${topup.priceInUsd} · one-time · available on Free and Pro</p>
                                </div>
                                <LoadingButton className="shrink-0" loading={loadingTopupCredits === topup.credits} loadingLabel="Opening checkout" onClick={() => void buyTopup(topup.credits)}>
                                    Buy for ${topup.priceInUsd}
                                </LoadingButton>
                            </article>
                        ))}
                    </section>
                )}

                <CreditsFaq />
            </main>

            <Dialog open={confirmDowngradeOpen} onOpenChange={setConfirmDowngradeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Downgrade to Free?</DialogTitle>
                        <DialogDescription>
                            {currentPlan && downgradeDate ? (
                                <>
                                    You'll keep <span className="text-foreground">{currentPlan.name}</span> until <span className="text-foreground">{downgradeDate}</span>. After that:
                                </>
                            ) : (
                                "After your current period ends:"
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <ul className="space-y-2 text-sm text-foreground">
                        {currentPlan && freePlan && (
                            <li className="flex items-baseline gap-2">
                                <span aria-hidden className="text-muted-foreground">
                                    −
                                </span>
                                <span className="tabular-nums">
                                    Credits drop from {formatCredits(currentPlan.includedCreditsPerMonth)} to {formatCredits(freePlan.includedCreditsPerMonth)} per month.
                                </span>
                            </li>
                        )}
                        <li className="flex items-baseline gap-2">
                            <span aria-hidden className="text-muted-foreground">
                                −
                            </span>
                            <span>Purchased and promotional credits remain available.</span>
                        </li>
                    </ul>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isDowngrading}>
                                Keep {currentPlan?.name ?? "current plan"}
                            </Button>
                        </DialogClose>
                        <LoadingButton variant="destructive" loading={isDowngrading} loadingLabel="Scheduling…" onClick={() => void confirmDowngradeToFree()}>
                            Downgrade to Free
                        </LoadingButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function CatalogErrorCard({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
            <div>
                <p className="text-sm font-medium text-foreground">Couldn't load pricing.</p>
                <p className="mt-1 text-sm text-muted-foreground">Check your connection or try again in a moment.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
            </Button>
        </div>
    )
}

function CreditsFaq() {
    return (
        <section id="faq" className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">FAQ</h2>
            <Accordion type="single" collapsible className="rounded-lg border border-border bg-card px-6">
                <AccordionItem value="credits" className="border-b-0">
                    <AccordionTrigger className="py-5 text-base font-semibold tracking-tight hover:no-underline">What are credits?</AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                            <p>
                                Credits pay for workflow usage. A workflow has a fixed cost of <span className="font-medium text-foreground">1 credit</span> per run. LLM calls, including calls to an
                                Agent, web research/search, and web monitoring, also cost credits and are billed according to usage.
                            </p>
                            <p>Actual usage depends on context size, output length, model choice, and how many AI steps the workflow needs.</p>
                        </div>

                        <div className="mt-5 overflow-x-auto">
                            <table className="w-full min-w-[560px] text-left text-sm">
                                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th scope="col" className="py-2 pr-4 font-medium">
                                            Workflow type
                                        </th>
                                        <th scope="col" className="py-2 px-4 text-right font-medium">
                                            Credits / run
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {PRO_USAGE_EXAMPLES.map(example => (
                                        <tr key={example.workflow}>
                                            <td className="py-3 pr-4 text-foreground">{example.workflow}</td>
                                            <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{example.cost}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </section>
    )
}

function PeriodToggle({ period, onChange, annualSavingsYearly }: { period: BillingPeriod; onChange: (next: BillingPeriod) => void; annualSavingsYearly: number | null }) {
    const annualLabel = annualSavingsYearly ? `Annual · save ${formatUsd(annualSavingsYearly)}/yr` : "Annual"
    const options: { value: BillingPeriod; label: string }[] = [
        { value: TimePeriods.MONTHLY, label: "Monthly" },
        { value: TimePeriods.YEARLY, label: annualLabel }
    ]
    return (
        <div role="group" aria-label="Billing period" className="relative inline-flex rounded-full border border-border bg-muted p-1 text-sm">
            {options.map(option => {
                const active = option.value === period
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={`relative z-10 rounded-full px-4 py-1 font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        {active && (
                            <motion.span
                                layoutId="period-toggle-active"
                                className="absolute inset-0 -z-10 rounded-full bg-background shadow-sm"
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
    scheduledNote,
    loading,
    onSelect
}: {
    plan: Plan
    period: BillingPeriod
    currentPlanKey: PlanKey | null
    currentPeriod: BillingPeriod | null
    scheduledNote: string | null
    loading: boolean
    onSelect: () => void
}) {
    const purchasable = isPurchasablePlan(plan)
    const isCurrentPlan = currentPlanKey === plan.key
    const isExactCurrent = isCurrentPlan && (!purchasable || currentPeriod === period)
    const monthlyPrice = plan.priceInUsdMonthly ?? 0
    const annualPrice = plan.priceInUsdMonthlyAnnual ?? 0
    const displayPrice = period === "yearly" && annualPrice > 0 ? annualPrice : monthlyPrice
    const priceLine = formatPriceLine(plan)

    const ctaLabel = isExactCurrent
        ? null
        : isCurrentPlan && purchasable
          ? `Switch to ${periodLabel(period)} billing`
          : plan.key === "free" && currentPlanKey && currentPlanKey !== "free"
            ? "Downgrade to Free"
            : purchasable
              ? currentPlanKey === "free"
                  ? `Upgrade to ${plan.name}`
                  : `Choose ${plan.name}`
              : "Get started"
    const ctaVariant: "default" | "outline" = purchasable && currentPlanKey !== plan.key ? "default" : "outline"

    return (
        <article className="flex flex-col rounded-lg border border-border bg-card p-6">
            <div>
                <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>
            </div>

            <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{purchasable ? `$${displayPrice.toFixed(0)}` : "$0"}</span>
                <span className="text-sm text-muted-foreground">/ mo</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground tabular-nums">{priceLine}</p>

            {scheduledNote && <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">{scheduledNote}</p>}

            <div className="mt-auto pt-6">
                {ctaLabel ? (
                    <LoadingButton className="w-full" variant={ctaVariant} loading={loading} loadingLabel="Opening checkout" onClick={onSelect}>
                        {ctaLabel}
                    </LoadingButton>
                ) : (
                    <div className="flex h-9 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">Current plan</div>
                )}
            </div>
        </article>
    )
}

function PlanCardSkeleton() {
    return (
        <div className="flex flex-col rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-5 h-9 w-28" />
            <Skeleton className="mt-2 h-4 w-56" />
            <Skeleton className="mt-2 h-3 w-3/4" />
            <Skeleton className="mt-auto h-10 w-full" />
        </div>
    )
}

function LoadingButton({ loading, loadingLabel, children, disabled, ...props }: ComponentProps<typeof Button> & { loading: boolean; loadingLabel: string }) {
    return (
        <Button {...props} disabled={loading || disabled}>
            {loading ? (
                <>
                    <Loader2 className="size-4 animate-spin" />
                    {loadingLabel}
                </>
            ) : (
                children
            )}
        </Button>
    )
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

function periodLabel(period: BillingPeriod): string {
    return period === "yearly" ? "annual" : "monthly"
}

function formatPriceLine(plan: Plan): string {
    return `${formatCredits(plan.includedCreditsPerMonth)} credits / mo`
}

const PRO_USAGE_EXAMPLES = [
    { workflow: "Deterministic workflow, no AI", cost: "1" },
    { workflow: "Deterministic workflow, little AI", cost: "1-3" },
    { workflow: "Tiny classification or routing", cost: "6-10" },
    { workflow: "Email or ticket triage summary", cost: "12-30" },
    { workflow: "CRM or lead scoring with AI judgment", cost: "25-60" },
    { workflow: "PR summary or release note draft", cost: "60-120" },
    { workflow: "Deeper code review or test plan", cost: "150-300" }
] as const

function formatScheduledNote(balance: BalanceSummary | null, plan: Plan): string | null {
    if (!balance?.scheduledChange) return null
    const change = balance.scheduledChange
    const date = dateFormatter.format(new Date(change.effectiveAt))
    if (change.kind === "cancel_to_free" && (plan.key === "free" || plan.key === balance.planKey)) {
        return `Downgrading to Free on ${date}.`
    }
    if (change.kind === "change_period" && isPurchasablePlan(plan)) {
        return `Switching to ${periodLabel(change.period)} billing on ${date}.`
    }
    return null
}

const getAnnualSavingsYearly = (plans: Plan[]) => {
    const purchasable = plans.find(p => isPurchasablePlan(p) && p.priceInUsdMonthly && p.priceInUsdMonthlyAnnual)
    if (!purchasable) return null
    const diff = (purchasable.priceInUsdMonthly! - purchasable.priceInUsdMonthlyAnnual!) * 12
    return diff > 0 ? diff : null
}
