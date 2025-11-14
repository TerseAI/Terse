import { useAutomations } from './useAutomations';

/**
 * Hook to get the total count of automations.
 * Uses useAutomations with minimal params (page: 1, limit: 1) to fetch only pagination info.
 */
export function useAutomationCount() {
    const { pagination, isLoading, isError } = useAutomations({ page: 1, limit: 1 });

    return {
        totalCount: pagination?.total ?? 0,
        isLoading,
        isError,
    };
}

