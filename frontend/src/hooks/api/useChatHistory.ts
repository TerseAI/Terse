import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import type { RunHistoryModelEvent, RunHistoryStatus } from "@/shared/RunHistoryTypes"

type ChatHistoryResponse = {
    events: Array<RunHistoryModelEvent>
    startTimestamp?: string
    endTimestamp?: string
    status?: RunHistoryStatus
}

export function useChatHistory(runId: string | null | undefined) {
    const key = runId ? ["chatHistory", runId] : null

    const { data, error, isLoading, isValidating, mutate } = useSWR<ChatHistoryResponse>(
        key,
        runId
            ? async () => {
                  return BackendProvider.getChatHistory(runId)
              }
            : null,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false
        }
    )

    return {
        events: data?.events ?? [],
        startTimestamp: data?.startTimestamp,
        endTimestamp: data?.endTimestamp,
        status: data?.status,
        isLoading: isLoading && !!runId,
        isError: error,
        isValidating,
        mutate
    }
}
