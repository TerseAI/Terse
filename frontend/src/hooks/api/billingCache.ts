import { mutate } from "swr"
import { billingCatalogKey, billingContextKey } from "terse-types/InvalidationKeys"

/** Revalidates billing data for all subscribers (SWR). Call after billing-affecting API calls from the client. */
export function invalidateBillingCaches(): void {
    void mutate(billingContextKey())
    void mutate(billingCatalogKey())
}
