import useSWR, { type KeyedMutator } from "swr"
import type { AttioIntegration } from "terse-types/Integrations"
import { attioIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

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
