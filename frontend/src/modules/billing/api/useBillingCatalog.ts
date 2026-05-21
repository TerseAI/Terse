import useSWR from "swr"
import type { KeyedMutator } from "swr"
import type { BillingCatalogResponse } from "terse-types"
import { billingCatalogKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useBillingCatalog(enabled: boolean = true): {
    plans: BillingCatalogResponse["plans"]
    topUps: BillingCatalogResponse["topUps"]
    isLoading: boolean
    isError: boolean
    mutate: KeyedMutator<BillingCatalogResponse>
} {
    const { data, error, isLoading, mutate } = useSWR<BillingCatalogResponse>(enabled ? billingCatalogKey() : null, () => BackendProvider.getBillingCatalog())

    return {
        plans: data?.plans ?? [],
        topUps: data?.topUps ?? [],
        isLoading,
        isError: Boolean(error),
        mutate
    }
}
