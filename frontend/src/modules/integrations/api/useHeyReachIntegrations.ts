import useSWR, { type KeyedMutator } from "swr"
import type { HeyReachIntegration } from "terse-types/Integrations"
import { heyReachIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UseHeyReachIntegrationsReturn = {
    integrations: HeyReachIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<HeyReachIntegration[]>
}

export function useHeyReachIntegrations(): UseHeyReachIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<HeyReachIntegration[]>(heyReachIntegrationsKey(), () => BackendProvider.getHeyReachIntegrations(), {
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
