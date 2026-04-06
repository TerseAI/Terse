import useSWR from "swr"
import type { AgentTemplate } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

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
