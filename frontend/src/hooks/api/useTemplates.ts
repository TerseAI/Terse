import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import type { AgentTemplate } from "@/shared/types"

export function useTemplates() {
    const { data, error, isValidating } = useSWR<AgentTemplate[]>(
        "templates",
        async () => {
            return BackendProvider.getTemplates()
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000 // Cache for 1 minute
        }
    )

    return {
        templates: data ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating
    }
}

export type { AgentTemplate }
