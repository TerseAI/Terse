import useSWR, { type KeyedMutator } from "swr"
import type { GmailIntegration } from "terse-types/Integrations"
import { gmailIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"
import { useOAuthSuccessListener } from "@/modules/auth/hooks/useOAuthSuccessListener"

type UseGmailIntegrationsReturn = {
    integrations: GmailIntegration[]
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: KeyedMutator<GmailIntegration[]>
}

export function useGmailIntegrations(): UseGmailIntegrationsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GmailIntegration[]>(gmailIntegrationsKey(), () => BackendProvider.getGmailIntegrations(), {
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
