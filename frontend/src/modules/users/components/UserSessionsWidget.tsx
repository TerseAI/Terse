import { UserSessions, WorkOsWidgets } from "@workos-inc/widgets"

import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from "@/hooks/useWorkOsTheme"
import { BackendProvider } from "@/lib/http"
import { useWidgetToken } from "@/modules/organizations/api/useWidgetToken"

export function UserSessionsWidget() {
    const appearance = useResolvedAppearance()
    const { token, isLoading, isError } = useWidgetToken()

    const getAccessToken = () => BackendProvider.getWidgetToken().then(d => d.token)

    if (isError) {
        return <p className="text-danger text-sm">Failed to load sessions.</p>
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserSessions authToken={getAccessToken} />
        </WorkOsWidgets>
    )
}
