import { mutate } from "swr"
import { billingCatalogKey, billingContextKey, billingStatusKey, billingUsageBucketsKey } from "terse-types/InvalidationKeys"

const billingContextKeyPrefix = billingContextKey()[0]
const billingUsageBucketsKeyPrefix = billingUsageBucketsKey()[0]

function isBillingContextSwrKey(key: unknown): boolean {
    return Array.isArray(key) && key[0] === billingContextKeyPrefix
}

function isBillingUsageBucketsSwrKey(key: unknown): boolean {
    return Array.isArray(key) && key[0] === billingUsageBucketsKeyPrefix
}

export function invalidateBillingCaches(): void {
    void mutate(key => isBillingContextSwrKey(key), undefined)
    void mutate(key => isBillingUsageBucketsSwrKey(key), undefined)
    void mutate(billingCatalogKey())
    void mutate(billingStatusKey())
}
