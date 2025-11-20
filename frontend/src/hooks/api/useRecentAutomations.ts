import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { RecentAutomation } from '@/shared/types';
import { recentAutomationsKey } from '@/shared/InvalidationKeys';

export function useRecentAutomations(limit = 3) {
    const { data, error, isLoading, mutate } = useSWR<RecentAutomation[]>(
        recentAutomationsKey(limit),
        () => BackendProvider.getRecentAutomations(limit),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        }
    );

    return {
        automations: data ?? [],
        isLoading,
        isError: error,
        mutate,
    };
}

