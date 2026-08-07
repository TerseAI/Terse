import useSWR from "swr"
import type { HiggsfieldIntegration } from "terse-types/Integrations"
import { higgsfieldIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useHiggsfieldIntegrations() {
    const result = useSWR<HiggsfieldIntegration[]>(higgsfieldIntegrationsKey(), () => BackendProvider.getHiggsfieldIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })
    return { integrations: result.data ?? [], isLoading: result.isLoading || (!result.data && !result.error), mutate: result.mutate }
}
