import useSWR from "swr"
import { AgentFileContentResponse, agentFileContentKey } from "terse-types"

import { BackendProvider } from "../../services/backend"

export function useAgentFileContent(agentId: string, fileId: string | undefined) {
    const key = fileId ? agentFileContentKey(agentId, fileId) : null

    const { data, error, isValidating, mutate } = useSWR<AgentFileContentResponse>(
        key,
        async () => {
            if (!fileId) {
                throw new Error("fileId is required")
            }
            return BackendProvider.getAgentFileContent(agentId, fileId)
        },
        {
            keepPreviousData: true
        }
    )
    return {
        path: data?.path,
        fileName: data?.fileName,
        contentBase64: data?.contentBase64,
        mimeType: data?.mimeType,
        isLoading: Boolean(fileId) && !data && !error,
        isError: Boolean(fileId) && error,
        isValidating,
        mutate
    }
}
