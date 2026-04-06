import useSWR from "swr"
import { widgetTokenKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

type WidgetTokenData = { token: string; expiresAt: string }

export function useWidgetToken() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<WidgetTokenData>(widgetTokenKey(), () => BackendProvider.getWidgetToken(), { revalidateOnFocus: false })

    return {
        token: data?.token ?? null,
        expiresAt: data?.expiresAt ?? null,
        isLoading: isLoading || (!data && !error),
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}
