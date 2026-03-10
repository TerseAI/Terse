import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { ApprovalRequestFilter, GetPendingApprovalsResponse } from "@/shared/ApprovalTypes"
import { pendingApprovalsKey } from "@/shared/InvalidationKeys"

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
