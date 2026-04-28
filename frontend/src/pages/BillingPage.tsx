import { useCallback, useEffect, useState } from "react"

import { CreditCard, PackagePlus, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { type BalanceSummary, type OverageMode, type UsageBucket } from "terse-types"

import { TopupDialog, UpgradeDialog } from "@/components/billing/BillingDialogs"
import { CreditBalanceWidget } from "@/components/billing/CreditBalanceWidget"
import { OverageModeToggle } from "@/components/billing/OverageModeToggle"
import { UsageChart } from "@/components/billing/UsageChart"
import { Button } from "@/components/ui/button"

import { BackendProvider } from "../services/backend"

export default function BillingPage() {
    const [balance, setBalance] = useState<BalanceSummary | null>(null)
    const [usage, setUsage] = useState<UsageBucket[] | null>(null)
    const [showUpgrade, setShowUpgrade] = useState(false)
    const [showTopup, setShowTopup] = useState(false)

    const refresh = useCallback(async () => {
        const [nextBalance, nextUsage] = await Promise.all([BackendProvider.getBalance(), BackendProvider.getUsage()])
        setBalance(nextBalance)
        setUsage(nextUsage.buckets)
    }, [])

    useEffect(() => {
        void refresh().catch(() => toast.error("Failed to load billing details"))
    }, [refresh])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (!params.get("upgraded") && !params.get("topup")) return

        toast.success(params.get("topup") ? "Top-up complete" : "Plan updated")
        let attempts = 0
        const interval = window.setInterval(() => {
            attempts += 1
            void refresh()
            if (attempts >= 5) window.clearInterval(interval)
        }, 2000)
        return () => window.clearInterval(interval)
    }, [refresh])

    const manageBilling = async () => {
        const { url } = await BackendProvider.createPortalSession()
        window.location.href = url
    }

    const updateMode = (mode: OverageMode) => {
        setBalance(current => (current ? { ...current, overageMode: mode } : current))
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-auto p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Monitor credit usage, change plans, and control overage behavior for this organization.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void refresh()}>
                            <RefreshCcw className="size-4" />
                            Refresh
                        </Button>
                        <Button variant="outline" onClick={manageBilling}>
                            <CreditCard className="size-4" />
                            Manage billing
                        </Button>
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-sm font-medium text-foreground">Credit usage</h2>
                            <p className="text-sm text-muted-foreground">Current billing period: {formatPeriod(balance)}</p>
                        </div>
                        <CreditBalanceWidget balance={balance} />
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-foreground">Actions</h2>
                        <div className="grid gap-3">
                            <Button className="justify-start" onClick={() => setShowTopup(true)}>
                                <PackagePlus className="size-4" />
                                Buy more credits
                            </Button>
                            <Button variant="outline" className="justify-start" onClick={() => setShowUpgrade(true)}>
                                <CreditCard className="size-4" />
                                Change plan
                            </Button>
                        </div>
                        <OverageModeToggle mode={balance?.overageMode ?? null} onChange={updateMode} />
                    </section>
                </div>

                <section className="space-y-3">
                    <div>
                        <h2 className="text-sm font-medium text-foreground">Daily usage</h2>
                        <p className="text-sm text-muted-foreground">Metered credit consumption from Stripe for the last 30 days.</p>
                    </div>
                    <UsageChart buckets={usage} />
                </section>
            </div>

            <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} />
            <TopupDialog open={showTopup} onOpenChange={setShowTopup} />
        </div>
    )
}

function formatPeriod(balance: BalanceSummary | null): string {
    if (!balance) return "loading"
    const start = new Date(balance.periodStart).toLocaleDateString()
    const end = new Date(balance.periodEnd).toLocaleDateString()
    return `${start} to ${end}`
}
