import { useAgents } from './useAgents';

/**
 * Hook to get the total count of channels.
 * Uses useAgents with minimal params (page: 1, limit: 1) to fetch only pagination info.
 */
export function useAgentCount() {
    const { pagination, isLoading, isError } = useAgents({ page: 1, limit: 1 });

    return {
        totalCount: pagination?.total ?? 0,
        isLoading,
        isError,
    };
}

