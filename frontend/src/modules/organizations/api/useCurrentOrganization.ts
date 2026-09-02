import useSWR from "swr"
import { currentOrganizationKey } from "terse-types/InvalidationKeys"
import type { OrganizationDetails } from "terse-types/types"

import { BackendProvider } from "@/lib/http"

export function useCurrentOrganization(organizationId: string | null | undefined) {
    const { data, error, isLoading, mutate } = useSWR<OrganizationDetails>(currentOrganizationKey(organizationId), () => BackendProvider.getCurrentOrganization())

    return {
        organization: data,
        isLoading,
        isError: Boolean(error),
        error,
        mutate
    }
}
