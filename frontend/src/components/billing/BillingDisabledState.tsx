import { Wallet } from "lucide-react"

/**
 * Shown when the deployment has usage-based billing turned off (`billingEnabled: false`).
 */
export function BillingDisabledState() {
    return (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center sm:px-10">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Wallet className="size-5" aria-hidden />
                </span>
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Billing is not enabled</h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        Plans, credits, and payment management are not available on this deployment. If your organization expects billing here, ask an administrator to
                        configure the billing service.
                    </p>
                </div>
            </div>
        </div>
    )
}
