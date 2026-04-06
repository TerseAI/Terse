import useSWR from "swr"
import { userOrganizationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

type Organization = { id: string; name: string }

export function useUserOrganizations() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<{
        organizations: Organization[]
    }>(userOrganizationsKey(), () => BackendProvider.getUserOrganizations())

    return {
        organizations: data?.organizations ?? [],
        isLoading: isLoading || (!data && !error),
        isError: Boolean(error),
        error,
        isValidating,
        mutate
    }
}
