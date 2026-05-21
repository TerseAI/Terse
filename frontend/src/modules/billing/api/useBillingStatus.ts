import useSWR from "swr"
import type { BillingStatusResponse } from "terse-types"
import { billingStatusKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useBillingStatus(enabled: boolean = true): {
    status: BillingStatusResponse | null
    isLoading: boolean
    isError: boolean
} {
    const { data, error, isLoading } = useSWR<BillingStatusResponse>(enabled ? billingStatusKey() : null, () => BackendProvider.getBillingStatus())

    return {
        status: data ?? null,
        isLoading,
        isError: Boolean(error)
    }
}
