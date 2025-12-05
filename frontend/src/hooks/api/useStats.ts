import useSWR, { KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import { statsKey } from '@/shared/InvalidationKeys';
import { StatsResponse } from '@/shared/types';

export type UseStatsReturn = {
    stats: StatsResponse | null;
    isLoading: boolean;
    isError: Error | null;
    mutate: KeyedMutator<StatsResponse>;
};

// Get the user's timezone, with fallback to UTC
function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

export function useStats() {
    const timezone = getUserTimezone()
    
    const { data, error, isLoading, mutate } = useSWR<StatsResponse>(
        statsKey(timezone),
        () => BackendProvider.getStats(timezone),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        }
    );

    return {
        stats: data ?? null,
        isLoading,
        isError: error,
        mutate,
    } as UseStatsReturn;
}

