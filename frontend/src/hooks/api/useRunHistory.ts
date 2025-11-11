import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { GetRunHistoryParams, GetRunHistoryResponse } from '@/shared/RunHistoryTypes';
import { runHistoryKey } from '@/shared/InvalidationKeys';

type UseRunHistoryParams = {
    automationId: string | null | undefined;
    page?: number;
    pageSize?: number;
    searchQuery?: string;
    dateRange?: { from: Date | undefined; to: Date | undefined };
    selectedStatuses?: Set<string>;
};

export function useRunHistory({
    automationId,
    page = 1,
    pageSize = 10,
    searchQuery = '',
    dateRange = { from: undefined, to: undefined },
    selectedStatuses = new Set(['success', 'failed', 'in_progress']),
}: UseRunHistoryParams) {
    // Convert date range to ISO strings
    const toLocalStartISOString = (d?: Date) => {
        if (!d) return undefined;
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    };
    const toLocalEndISOString = (d?: Date) => {
        if (!d) return undefined;
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
    };

    // Build params object
    // Convert Set to sorted array for consistent key generation
    const statusArray = Array.from(selectedStatuses).sort();
    const params: GetRunHistoryParams = {
        page,
        pageSize,
        q: searchQuery.trim() || undefined,
        start: toLocalStartISOString(dateRange.from),
        end: toLocalEndISOString(dateRange.to ?? dateRange.from),
        status: statusArray.length < 4 ? statusArray as any : undefined,
    };
    
    if (!automationId) {
        return {
            runs: [],
            total: 0,
            page: page,
            pageSize: pageSize,
            isLoading: false,
            isError: null,
            isValidating: false,
            mutate: () => {},
        };
    }
    
    const key = runHistoryKey(automationId, params);

    const { data, error, isValidating, mutate } = useSWR<GetRunHistoryResponse>(
        key,
        automationId ? async () => {
            return BackendProvider.getRunHistory(automationId, params);
        } : null,
        {
            keepPreviousData: true,
        }
    );

    return {
        runs: data?.items ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? page,
        pageSize: data?.pageSize ?? pageSize,
        isLoading: !data && !error && !!automationId,
        isError: error,
        isValidating,
        mutate,
    };
}