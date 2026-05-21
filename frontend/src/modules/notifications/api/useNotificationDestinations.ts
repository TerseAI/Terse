import useSWR from "swr"
import { notificationDestinationsKey } from "terse-types"
import { NotificationDestination } from "terse-types"

import { BackendProvider } from "@/lib/http"

export function useNotificationDestinations() {
    const key = notificationDestinationsKey()

    const { data, error, isValidating, mutate } = useSWR<NotificationDestination[]>(key, async () => {
        return BackendProvider.getNotificationDestinations()
    })

    return { notificationDestinations: data, isError: error, isValidating, mutate }
}
