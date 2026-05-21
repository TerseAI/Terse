import useSWR from "swr"
import { notificationSettingsKey } from "terse-types"
import { NotificationSettings } from "terse-types"

import { BackendProvider } from "@/lib/http"

export function useNotificationSettings() {
    const key = notificationSettingsKey()

    const { data, error, isValidating, mutate } = useSWR<NotificationSettings>(key, async () => {
        return BackendProvider.getNotificationSettings()
    })

    return { notificationSettings: data, isError: error, isValidating, mutate }
}
