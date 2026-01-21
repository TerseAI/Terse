import useSWR, { KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { RecentAgent } from '@/shared/types';
import { recentChannelsKey } from '@/shared/InvalidationKeys';

export type UseRecentChannelsReturn = {
    channels: RecentAgent[];
    isLoading: boolean;
    isError: Error | null;
    mutate: KeyedMutator<RecentAgent[]>;
};

export function useRecentChannels(limit = 3) {
    const { data, error, isLoading, mutate } = useSWR<RecentAgent[]>(
        recentChannelsKey(limit),
        () => BackendProvider.getRecentChannels(limit),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        }
    );

    return {
        channels: data ?? [],
        isLoading,
        isError: error,
        mutate,
    } as UseRecentChannelsReturn;
}

