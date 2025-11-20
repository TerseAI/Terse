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

export function useStats() {
    const { data, error, isLoading, mutate } = useSWR<StatsResponse>(
        statsKey(),
        () => BackendProvider.getStats(),
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

