import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { allRunHistoryKey } from "@/shared/InvalidationKeys"
import type { GetAllRunHistoryResponse, GetRunHistoryParams, RunHistoryStatus } from "@/shared/RunHistoryTypes"

type UseAllRunHistoryParams = {
    page?: number
    pageSize?: number
    searchQuery?: string
    dateRange?: { from: Date | undefined; to: Date | undefined }
    selectedStatuses: Set<RunHistoryStatus>
}

export function useAllRunHistory({ page = 1, pageSize = 20, searchQuery = "", dateRange = { from: undefined, to: undefined }, selectedStatuses }: UseAllRunHistoryParams) {
    // Convert date range to ISO strings
    const toLocalStartISOString = (d?: Date) => {
        if (!d) return undefined
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString()
    }
    const toLocalEndISOString = (d?: Date) => {
        if (!d) return undefined
        const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
        return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString()
    }

    const params: GetRunHistoryParams = {
        page,
        pageSize,
        q: searchQuery.trim() || undefined,
        start: toLocalStartISOString(dateRange.from),
        end: toLocalEndISOString(dateRange.to ?? dateRange.from),
        status: Array.from(selectedStatuses).sort()
    }

    const key = allRunHistoryKey(params)

    const { data, error, isValidating, mutate } = useSWR<GetAllRunHistoryResponse>(
        key,
        async () => BackendProvider.getAllRunHistory(params),
        { keepPreviousData: true }
    )

    return {
        runs: data?.items ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? page,
        pageSize: data?.pageSize ?? pageSize,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
