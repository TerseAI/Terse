import { useState } from "react"

import { CreditCard } from "lucide-react"
import { type PlanKey, getAllPlans } from "terse-types"

import { Button } from "@/components/ui/button"
import { POST_LOGIN_REDIRECT_KEY } from "@/constants/storageKeys"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"

export default function PricingPage() {
    const { user } = useAuth()
    const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)

    const selectPlan = async (planKey: PlanKey) => {
        if (!user) {
            localStorage.setItem(POST_LOGIN_REDIRECT_KEY, "/pricing")
            BackendProvider.loginRedirect()
            return
        }

        if (planKey === "free") {
            window.location.href = "/app"
            return
        }

        setLoadingPlan(planKey)
        try {
            const { url } = await BackendProvider.createCheckoutForPlan(planKey, "monthly")
            window.location.href = url
        } finally {
            setLoadingPlan(null)
        }
    }

    return (
        <div className="min-h-full overflow-auto bg-background px-4 py-10 text-foreground">
            <main className="mx-auto flex max-w-5xl flex-col gap-8">
                <section className="max-w-3xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-sm text-muted-foreground">
                        <CreditCard className="size-4 text-primary" />
                        Credit-based billing
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight">Plans for Terse automations</h1>
                    <p className="mt-3 max-w-2xl text-base text-muted-foreground">Start with a fixed monthly allowance, then upgrade when your SDK jobs and agents need more room.</p>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                    {getAllPlans().map(plan => (
                        <article key={plan.key} className="flex min-h-[320px] flex-col rounded-lg border bg-card p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold">{plan.name}</h2>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-semibold">${plan.priceInUsdMonthly ? plan.priceInUsdMonthly.toFixed(2) : "Free"}</div>
                                    <div className="text-sm text-muted-foreground">per month</div>
                                </div>
                            </div>

                            <div className="mt-5 text-sm font-medium">{plan.includedCreditsPerMonth.toLocaleString()} credits included</div>
                            <Button className="mt-6" variant={plan.key === "pro" ? "default" : "outline"} disabled={loadingPlan === plan.key} onClick={() => void selectPlan(plan.key)}>
                                {plan.key === "free" ? "Get started" : "Upgrade"}
                            </Button>
                        </article>
                    ))}
                </section>
            </main>
        </div>
    )
}
