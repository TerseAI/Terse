import useSWR from "swr"
import { ApprovalRequestFilter, GetPendingApprovalsResponse } from "terse-types/ApprovalTypes"
import { pendingApprovalsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/services/backend"

type UsePendingApprovalsParams = {
    status?: ApprovalRequestFilter
}

export function usePendingApprovals({ status = "all" }: UsePendingApprovalsParams = {}) {
    const key = [...pendingApprovalsKey(), status] as const

    const { data, error, isValidating, mutate } = useSWR<GetPendingApprovalsResponse>(key, async () => BackendProvider.getPendingApprovals({ status }), {
        keepPreviousData: true
    })

    return {
        approvals: data?.items ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
