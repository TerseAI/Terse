import useSWR, { type KeyedMutator } from "swr"
import type { BalanceSummary, BillingContextQuery, BillingContextResponse, UsageBucket } from "terse-types"
import { billingContextKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"
import { getUserTimezone } from "@/utility/timezone"

export function useBillingContext(
    enabled: boolean,
    params?: Partial<BillingContextQuery>
): {
    billingEnabled: boolean | null
    balance: BalanceSummary | null
    buckets: UsageBucket[] | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<BillingContextResponse>
} {
    const timezone = params?.timezone ?? getUserTimezone()
    const requestParams = { ...params, timezone }
    const { data, error, isLoading, isValidating, mutate } = useSWR(enabled ? billingContextKey(requestParams) : null, () => BackendProvider.getBillingContext(requestParams))

    return {
        billingEnabled: data?.billingEnabled ?? null,
        balance: data?.balance ?? null,
        buckets: data?.usage.buckets ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
