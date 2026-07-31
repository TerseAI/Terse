import useSWR, { type KeyedMutator } from "swr"
import type { GoogleSearchConsoleIntegration } from "terse-types/Integrations"
import { googleSearchConsoleIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UseGoogleSearchConsoleIntegrationsReturn = {
    integrations: GoogleSearchConsoleIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<GoogleSearchConsoleIntegration[]>
}

export function useGoogleSearchConsoleIntegrations(): UseGoogleSearchConsoleIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GoogleSearchConsoleIntegration[]>(
        googleSearchConsoleIntegrationsKey(),
        () => BackendProvider.getGoogleSearchConsoleIntegrations(),
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true
        }
    )

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
