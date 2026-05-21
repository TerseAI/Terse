import useSWR from "swr"
import type { TriggerPayload } from "terse-types"
import type { RunHistoryModelEvent, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { BackendProvider } from "@/lib/http"

type ChatHistoryResponse = {
    events: Array<RunHistoryModelEvent>
    startTimestamp?: string
    endTimestamp?: string
    status?: RunHistoryStatus
} & Partial<TriggerPayload>

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
        triggerEvent: data?.triggerEvent ?? null,
        triggerEventType: data?.triggerEventType ?? null,
        isTriggerEventTruncated: data?.isTriggerEventTruncated ?? false,
        isLoading: isLoading && !!runId,
        isError: error,
        isValidating,
        mutate
    }
}
