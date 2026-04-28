import { CreditCard, PackagePlus } from "lucide-react"
import { type BillingPeriod, type PlanKey, getAllPlans, getAllTopups } from "terse-types"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { BackendProvider } from "../../services/backend"

export function UpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const checkout = async (planKey: PlanKey, period: BillingPeriod) => {
        const { url } = await BackendProvider.createCheckoutForPlan(planKey, period)
        window.location.href = url
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change plan</DialogTitle>
                    <DialogDescription>Select a billing period and continue to Stripe Checkout.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    {getAllPlans().map(plan => (
                        <div key={plan.key} className="rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 font-semibold">
                                        <CreditCard className="size-4 text-primary" />
                                        {plan.name}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{plan.includedCreditsPerMonth.toLocaleString()} credits per month.</p>
                                </div>
                                <div className="text-right text-sm">
                                    <div className="text-lg font-semibold">${plan.priceInUsdMonthly}/mo</div>
                                    <div className="text-muted-foreground">${plan.priceInUsdMonthlyAnnual}/mo annually</div>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button onClick={() => checkout(plan.key, "monthly")}>Monthly</Button>
                                <Button variant="outline" onClick={() => checkout(plan.key, "yearly")}>
                                    Annual
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function TopupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const checkout = async (credits: number) => {
        const { url } = await BackendProvider.createCheckoutForTopup(credits)
        window.location.href = url
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Buy more credits</DialogTitle>
                    <DialogDescription>Top-up credits apply to metered usage and do not expire.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    {getAllTopups().map(topup => (
                        <div key={topup.credits} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                            <div>
                                <div className="flex items-center gap-2 font-semibold">
                                    <PackagePlus className="size-4 text-primary" />
                                    {topup.credits.toLocaleString()} credits
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">One-time credit grant.</p>
                            </div>
                            <Button onClick={() => checkout(topup.credits)}>${topup.priceInUsd}</Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
