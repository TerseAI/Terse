import useSWR, { type KeyedMutator } from "swr"
import type { BalanceSummary } from "terse-types"
import { billingBalanceKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

export function useBillingBalance(enabled: boolean): {
    balance: BalanceSummary | null
    isLoading: boolean
    isValidating: boolean
    isError: boolean
    mutate: KeyedMutator<BalanceSummary>
} {
    const { data, error, isLoading, isValidating, mutate } = useSWR<BalanceSummary>(enabled ? billingBalanceKey() : null, () => BackendProvider.getBalance())

    return {
        balance: data ?? null,
        isLoading,
        isValidating,
        isError: Boolean(error),
        mutate
    }
}
