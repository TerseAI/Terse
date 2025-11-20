import { useChannels } from './useChannels';

/**
 * Hook to get the total count of channels.
 * Uses useChannels with minimal params (page: 1, limit: 1) to fetch only pagination info.
 */
export function useChannelCount() {
    const { pagination, isLoading, isError } = useChannels({ page: 1, limit: 1 });

    return {
        totalCount: pagination?.total ?? 0,
        isLoading,
        isError,
    };
}

