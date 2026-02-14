import useSWR, { type KeyedMutator } from "swr"

import { useOAuthSuccessListener } from "@/hooks/useOAuthSuccessListener"
import { BackendProvider } from "@/services/backend"
import type { AttioIntegration } from "@/shared/Integrations"
import { attioIntegrationsKey } from "@/shared/InvalidationKeys"

type UseAttioIntegrationsReturn = {
    integrations: AttioIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<AttioIntegration[]>
}

export function useAttioIntegrations(): UseAttioIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<AttioIntegration[]>(attioIntegrationsKey(), () => BackendProvider.getAttioIntegrations(), {
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
