import { mutate } from "swr"
import { billingContextKey } from "terse-types/InvalidationKeys"

/** Revalidates billing context (balance + usage) for all subscribers (SWR). Call after billing-affecting API calls from the client. */
export function invalidateBillingCaches(): void {
    void mutate(billingContextKey())
}
