import useSWR, { type KeyedMutator } from "swr"
import type { UsageBucket } from "terse-types"
import { billingUsageKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

export function useBillingUsage(enabled: boolean): {
    buckets: UsageBucket[] | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<UsageBucket[]>
} {
    const { data, error, isLoading, isValidating, mutate } = useSWR(enabled ? billingUsageKey() : null, async () => {
        const res = await BackendProvider.getUsage()
        return res.buckets
    })

    return {
        buckets: data ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
