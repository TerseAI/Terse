import useSWR, { type KeyedMutator } from "swr"
import type { BillingUsageBucketsQuery, UsageBucket, UsageResponse } from "terse-types"
import { billingUsageBucketsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"
import { getUserTimezone } from "@/utility/timezone"

export function useBillingUsageBuckets(params?: Partial<BillingUsageBucketsQuery>): {
    buckets: UsageBucket[] | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<UsageResponse>
} {
    const timezone = params?.timezone ?? getUserTimezone()
    const requestParams = { ...params, timezone }
    const { data, error, isLoading, isValidating, mutate } = useSWR(billingUsageBucketsKey(requestParams), () => BackendProvider.getBillingUsageBuckets(requestParams))

    return {
        buckets: data?.buckets ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
