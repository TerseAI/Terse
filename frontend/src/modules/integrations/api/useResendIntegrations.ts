import useSWR from "swr"
import type { ResendIntegration } from "terse-types/Integrations"
import { resendIntegrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useResendIntegrations() {
    const result = useSWR<ResendIntegration[]>(resendIntegrationsKey(), () => BackendProvider.getResendIntegrations(), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true
    })
    return { integrations: result.data ?? [], isLoading: result.isLoading || (!result.data && !result.error), mutate: result.mutate }
}
