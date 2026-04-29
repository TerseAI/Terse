import { type ComponentProps, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { motion } from "framer-motion"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { type BalanceSummary, type BillingPeriod, FrontendRoutes, type Plan, PlanKey, getAllPlans, getAllTopups, getPlanDetails, isPurchasablePlan } from "terse-types"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { POST_LOGIN_REDIRECT_KEY } from "@/constants/storageKeys"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"
import { formatCredits, formatUsd } from "@/utility/billingFormat"

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

function periodLabel(period: BillingPeriod): string {
    return period === "yearly" ? "annual" : "monthly"
}

function formatPriceLine(plan: Plan, period: BillingPeriod): string {
    const credits = `${formatCredits(plan.includedCreditsPerMonth)} credits / mo`
    if (!isPurchasablePlan(plan.key) || !plan.priceInUsdMonthly) {
        return `$0 · ${credits}`
    }
    if (period === "yearly" && plan.priceInUsdMonthlyAnnual) {
        const yearlySavings = (plan.priceInUsdMonthly - plan.priceInUsdMonthlyAnnual) * 12
        const savings = yearlySavings > 0 ? ` · save ${formatUsd(yearlySavings)}/yr` : ""
        return `${formatUsd(plan.priceInUsdMonthlyAnnual)}/mo billed yearly · ${credits}${savings}`
    }
    return `${formatUsd(plan.priceInUsdMonthly)}/mo · ${credits}`
}

function formatOveragePrint(plan: Plan): string {
    if (!plan.overageCentsPerCredit || !plan.hardCapMultiplier || plan.hardCapMultiplier <= 1) {
        return "Runs pause when you hit your monthly allowance. No overage, no surprise charges."
    }
    const dollars = (plan.overageCentsPerCredit / 100).toFixed(3)
    return `Optional soft overage at $${dollars}/credit, capped at ${plan.hardCapMultiplier}× your monthly allowance.`
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
    if (change.kind === "cancel_to_free" && plan.key === "free") {
        return `Downgrading to Free on ${date}.`
    }
    if (change.kind === "change_period" && isPurchasablePlan(plan.key)) {
        return `Switching to ${periodLabel(change.period)} billing on ${date}.`
    }
    return null
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
    const [confirmDowngradeOpen, setConfirmDowngradeOpen] = useState(false)

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

    const annualSavingsMonthly = useMemo(() => {
        const purchasable = plans.find(p => isPurchasablePlan(p.key) && p.priceInUsdMonthly && p.priceInUsdMonthlyAnnual)
        if (!purchasable) return null
        const diff = purchasable.priceInUsdMonthly! - purchasable.priceInUsdMonthlyAnnual!
        return diff > 0 ? diff : null
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

    const confirmDowngradeToFree = async () => {
        setConfirmDowngradeOpen(false)
        setLoadingPlan(PlanKey.FREE)
        try {
            await BackendProvider.changeBillingSubscription({ kind: "cancel_to_free" })
            toast.success("Downgrade scheduled for the end of your billing period.")
            navigate(FrontendRoutes.BILLING)
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

    const showTopups = !!balance?.canBuyTopups

    const currentPlan = currentPlanKey ? getPlanDetails(currentPlanKey) : null
    const freePlan = getPlanDetails(PlanKey.FREE)
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
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">Upgrade to Pro for more credits and soft overages.</p>
                </header>

                <section id="plans" className="space-y-5">
                    <PeriodToggle period={period} onChange={setPeriod} annualSavingsMonthly={annualSavingsMonthly} />

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
                            <p className="mt-1 text-sm text-muted-foreground">Top-ups stack on top of your plan and never expire.</p>
                        </div>
                        {getAllTopups().map(topup => (
                            <article key={topup.credits} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
                                <div className="min-w-0">
                                    <div className="text-base font-medium tabular-nums">Top up {topup.credits.toLocaleString()} credits</div>
                                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">${topup.priceInUsd} · one-time · adds to your current balance</p>
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
                        {currentPlan && (
                            <li className="flex items-baseline gap-2">
                                <span aria-hidden className="text-muted-foreground">
                                    −
                                </span>
                                <span className="tabular-nums">
                                    Credits drop from {formatCredits(currentPlan.includedCreditsPerMonth)} to {formatCredits(freePlan.includedCreditsPerMonth)} per month.
                                </span>
                            </li>
                        )}
                        {currentPlan?.overageCentsPerCredit ? (
                            <li className="flex items-baseline gap-2">
                                <span aria-hidden className="text-muted-foreground">
                                    −
                                </span>
                                <span>Soft overage stops — runs pause when credits run out.</span>
                            </li>
                        ) : null}
                        <li className="flex items-baseline gap-2">
                            <span aria-hidden className="text-muted-foreground">
                                −
                            </span>
                            <span>Top-ups are no longer available.</span>
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

function PeriodToggle({ period, onChange, annualSavingsMonthly }: { period: BillingPeriod; onChange: (next: BillingPeriod) => void; annualSavingsMonthly: number | null }) {
    const annualLabel = annualSavingsMonthly ? `Annual · save ${formatUsd(annualSavingsMonthly)}/mo` : "Annual"
    const options: { value: BillingPeriod; label: string }[] = [
        { value: "monthly", label: "Monthly" },
        { value: "yearly", label: annualLabel }
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
    const purchasable = isPurchasablePlan(plan.key)
    const isCurrentPlan = currentPlanKey === plan.key
    const isExactCurrent = isCurrentPlan && (!purchasable || currentPeriod === period)
    const monthlyPrice = plan.priceInUsdMonthly ?? 0
    const annualPrice = plan.priceInUsdMonthlyAnnual ?? 0
    const displayPrice = period === "yearly" && annualPrice > 0 ? annualPrice : monthlyPrice
    const overagePrint = formatOveragePrint(plan)
    const priceLine = formatPriceLine(plan, period)

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

            {overagePrint && <p className="mt-2 text-xs text-muted-foreground">{overagePrint}</p>}

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
