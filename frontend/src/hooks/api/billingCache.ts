import { mutate } from "swr"
import { billingBalanceKey, billingUsageKey } from "terse-types/InvalidationKeys"

/** Revalidates billing balance and usage for all subscribers (SWR). Call after billing-affecting API calls from the client. */
export function invalidateBillingCaches(): void {
    void mutate(billingBalanceKey())
    void mutate(billingUsageKey())
}
