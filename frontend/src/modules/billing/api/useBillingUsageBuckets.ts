import useSWR, { type KeyedMutator } from "swr"
import type { BillingUsageBucketsQuery, UsageBucket, UsageResponse } from "terse-types"
import { billingUsageBucketsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { getUserTimezone } from "@/utils/timezone"

export function useBillingUsageBuckets(params: BillingUsageBucketsQuery | null): {
    buckets: UsageBucket[] | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<UsageResponse>
} {
    // The range is derived from the billing period, which is only known once the
    // billing context has loaded. Pass a null key until then so SWR defers the
    // request instead of fetching an incorrect default window.
    const requestParams = params ? { ...params, timezone: params.timezone ?? getUserTimezone() } : null
    const { data, error, isLoading, isValidating, mutate } = useSWR(
        requestParams ? billingUsageBucketsKey(requestParams) : null,
        requestParams ? () => BackendProvider.getBillingUsageBuckets(requestParams) : null
    )

    return {
        buckets: data?.buckets ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
