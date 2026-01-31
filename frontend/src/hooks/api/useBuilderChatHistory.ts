import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { RunHistoryModelEvent } from '@/shared/RunHistoryTypes';
import { builderChatHistoryKey } from '@/shared/InvalidationKeys';

type BuilderChatHistoryResponse = {
    events: Array<RunHistoryModelEvent>;
    startTimestamp: string | null;
    endTimestamp: string | null;
};

/**
 * Hook to fetch builder chat history for a session.
 * Returns ModelEvents that can be converted to Turns via convertRunHistoryEventsToTurns.
 */
export function useBuilderChatHistory(sessionId: string | null | undefined) {
    const key = builderChatHistoryKey(sessionId);

    const { data, error, isLoading, isValidating, mutate } = useSWR<BuilderChatHistoryResponse>(
        key,
        sessionId ? async () => {
            return BackendProvider.getBuilderChatHistory(sessionId);
        } : null,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    return {
        events: data?.events ?? [],
        startTimestamp: data?.startTimestamp ?? null,
        endTimestamp: data?.endTimestamp ?? null,
        isLoading: isLoading && !!sessionId,
        isError: error,
        isValidating,
        mutate,
    };
}
