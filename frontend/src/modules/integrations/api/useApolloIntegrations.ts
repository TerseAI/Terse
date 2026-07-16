import useSWR from "swr"
import type { ApolloIntegration } from "terse-types/Integrations"
import { apolloIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useApolloIntegrations() {
    const result = useSWR<ApolloIntegration[]>(apolloIntegrationsKey(), () => BackendProvider.getApolloIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })
    return { integrations: result.data ?? [], isLoading: result.isLoading || (!result.data && !result.error), mutate: result.mutate }
}
