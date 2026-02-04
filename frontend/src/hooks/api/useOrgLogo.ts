import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { orgLogoKey } from "@/shared/InvalidationKeys"

export function useOrgLogo(organizationId: string | null | undefined) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<string | null>(orgLogoKey(organizationId), () => BackendProvider.getOrgLogoUrl(organizationId!), {
        revalidateOnFocus: false
    })

    return {
        logoUrl: data ?? null,
        isLoading: isLoading || (!data && !error && !!organizationId),
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}
