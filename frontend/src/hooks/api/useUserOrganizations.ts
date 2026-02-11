import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { userOrganizationsKey } from "@/shared/InvalidationKeys"

type Organization = { id: string; name: string }

export function useUserOrganizations() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<{
        organizations: Organization[]
    }>(userOrganizationsKey(), () => BackendProvider.getUserOrganizations(), {
        revalidateOnFocus: false
    })

    return {
        organizations: data?.organizations ?? [],
        isLoading: isLoading || (!data && !error),
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}
