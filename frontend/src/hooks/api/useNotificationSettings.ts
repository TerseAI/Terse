import useSWR from "swr"

import { BackendProvider } from "../../services/backend"
import { notificationSettingsKey } from "../../shared/InvalidationKeys"
import { NotificationSettings } from "../../shared/Notifications"

export function useNotificationSettings() {
    const key = notificationSettingsKey()

    const { data, error, isValidating, mutate } = useSWR<NotificationSettings>(key, async () => {
        return BackendProvider.getNotificationSettings()
    })

    return { notificationSettings: data, isError: error, isValidating, mutate }
}
