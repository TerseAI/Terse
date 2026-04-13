import useSWR from "swr"
import { AgentFilesResponse, agentFilesKey } from "terse-types"

import { BackendProvider } from "../../services/backend"

export function useAgentFiles(agentId: string) {
    const key = agentFilesKey(agentId)

    const { data, error, isValidating, mutate } = useSWR<AgentFilesResponse>(
        key,
        async () => {
            return BackendProvider.getAgentFiles(agentId)
        },
        {
            keepPreviousData: true
        }
    )
    return {
        files: data?.files,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
