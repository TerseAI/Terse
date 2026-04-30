import useSWR, { type KeyedMutator } from "swr"
import type { BalanceSummary, BillingContextResponse, UsageBucket } from "terse-types"
import { billingContextKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

export function useBillingContext(
    enabled: boolean,
    params?: { start?: Date; end?: Date }
): {
    balance: BalanceSummary | null
    buckets: UsageBucket[] | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<BillingContextResponse>
} {
    const { data, error, isLoading, isValidating, mutate } = useSWR(enabled ? billingContextKey() : null, () => BackendProvider.getBillingContext(params))

    return {
        balance: data?.balance ?? null,
        buckets: data?.usage.buckets ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
