import useSWR from "swr"

import { BackendProvider } from "../../services/backend"
import { notificationDestinationsKey } from "../../shared/InvalidationKeys"
import { NotificationDestination } from "../../shared/Notifications"

export function useNotificationDestinations() {
    const key = notificationDestinationsKey()

    const { data, error, isValidating, mutate } = useSWR<NotificationDestination[]>(key, async () => {
        return BackendProvider.getNotificationDestinations()
    })

    return { notificationDestinations: data, isError: error, isValidating, mutate }
}
