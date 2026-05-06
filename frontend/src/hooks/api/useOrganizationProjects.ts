import useSWR from "swr"

import type { ProjectsListResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

const ORGANIZATION_PROJECTS_KEY = ["organization-projects"] as const

export function useOrganizationProjects() {
    const { data, error, isValidating, mutate } = useSWR<ProjectsListResponse>(ORGANIZATION_PROJECTS_KEY, () => BackendProvider.listProjects(), {
        revalidateOnFocus: false
    })

    return {
        projects: data?.projects ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
