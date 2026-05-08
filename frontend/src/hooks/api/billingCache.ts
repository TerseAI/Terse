import { mutate } from "swr"
import { billingCatalogKey, billingContextKey, billingStatusKey } from "terse-types/InvalidationKeys"

const billingContextKeyPrefix = billingContextKey()[0]

function isBillingContextSwrKey(key: unknown): boolean {
    return Array.isArray(key) && key[0] === billingContextKeyPrefix
}

export function invalidateBillingCaches(): void {
    void mutate(key => isBillingContextSwrKey(key), undefined)
    void mutate(billingCatalogKey())
    void mutate(billingStatusKey())
}
