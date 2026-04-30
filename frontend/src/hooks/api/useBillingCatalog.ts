import useSWR from "swr"
import type { KeyedMutator } from "swr"
import type { BillingCatalogResponse } from "terse-types"
import { billingCatalogKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

export function useBillingCatalog(): {
    plans: BillingCatalogResponse["plans"]
    topUps: BillingCatalogResponse["topUps"]
    isLoading: boolean
    isError: boolean
    mutate: KeyedMutator<BillingCatalogResponse>
} {
    const { data, error, isLoading, mutate } = useSWR<BillingCatalogResponse>(billingCatalogKey(), () => BackendProvider.getBillingCatalog())

    return {
        plans: data?.plans ?? [],
        topUps: data?.topUps ?? [],
        isLoading,
        isError: Boolean(error),
        mutate
    }
}
