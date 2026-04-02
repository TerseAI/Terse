import useSWR from "swr"
import { sentNotificationsKey } from "terse-types/InvalidationKeys"
import type { GetSentNotificationsResponse } from "terse-types/SentNotifications"

import { BackendProvider } from "@/services/backend"

type UseSentNotificationsParams = {
    page?: number
    pageSize?: number
}

export function useSentNotifications({ page = 1, pageSize = 12 }: UseSentNotificationsParams = {}) {
    const key = [...sentNotificationsKey(), page, pageSize] as const

    const { data, error, isValidating } = useSWR<GetSentNotificationsResponse>(key, async () => BackendProvider.getSentNotifications({ page, pageSize }), {
        keepPreviousData: true
    })

    return {
        notifications: data?.items ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? page,
        pageSize: data?.pageSize ?? pageSize,
        isLoading: !data && !error,
        isError: error,
        isValidating
    }
}
