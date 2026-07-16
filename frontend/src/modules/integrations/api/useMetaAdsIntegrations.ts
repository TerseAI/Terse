import useSWR, { type KeyedMutator } from "swr"
import type { MetaAdsIntegration } from "terse-types/Integrations"
import { metaAdsIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

export function useMetaAdsIntegrations(): UseMetaAdsIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<MetaAdsIntegration[]>(metaAdsIntegrationsKey(), () => BackendProvider.getMetaAdsIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })

    useOAuthSuccessListener(mutate)

    const loading = isLoading || (!data && !error)

    return {
        integrations: data ?? [],
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}

type UseMetaAdsIntegrationsReturn = {
    integrations: MetaAdsIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<MetaAdsIntegration[]>
}
