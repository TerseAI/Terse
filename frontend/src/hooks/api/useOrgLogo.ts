import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { orgLogoKey } from "@/shared/InvalidationKeys"

export function useOrgLogo(organizationId: string | null | undefined) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<string | null>(orgLogoKey(organizationId), () => BackendProvider.getOrgLogoUrl(organizationId!), {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 60000
    })

    return {
        logoUrl: data ?? null,
        isLoading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}
