import useSWR, { type KeyedMutator } from "swr"
import type { BalanceSummary, BillingContextQuery, BillingContextResponse } from "terse-types"
import { billingContextKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { getUserTimezone } from "@/utils/timezone"

export function useBillingContext(params?: Partial<BillingContextQuery>): {
    billingEnabled: boolean | null
    balance: BalanceSummary | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<BillingContextResponse>
} {
    const timezone = params?.timezone ?? getUserTimezone()
    const requestParams = { ...params, timezone }
    const { data, error, isLoading, isValidating, mutate } = useSWR(billingContextKey(requestParams), () => BackendProvider.getBillingContext(requestParams))

    return {
        billingEnabled: data?.billingEnabled ?? null,
        balance: data?.balance ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
