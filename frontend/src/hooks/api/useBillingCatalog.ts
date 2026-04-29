import useSWR from "swr"
import type { BillingCatalogResponse } from "terse-types"
import { billingCatalogKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

export function useBillingCatalog(): {
    plans: BillingCatalogResponse["plans"]
    topUps: BillingCatalogResponse["topUps"]
    isLoading: boolean
    isError: boolean
} {
    const { data, error, isLoading } = useSWR<BillingCatalogResponse>(billingCatalogKey(), () => BackendProvider.getBillingCatalog())

    return {
        plans: data?.plans ?? [],
        topUps: data?.topUps ?? [],
        isLoading,
        isError: Boolean(error)
    }
}
