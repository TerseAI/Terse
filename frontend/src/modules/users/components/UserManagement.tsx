import { UsersManagement, WorkOsWidgets } from "@workos-inc/widgets"

import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from "@/hooks/useWorkOsTheme"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { useWidgetToken } from "@/modules/organizations/api/useWidgetToken"

export function UserTable() {
    const { user } = useAuth()
    const appearance = useResolvedAppearance()
    const { token, isLoading, isError } = useWidgetToken()

    if (user && !user.organizationId) {
        return <p className="text-danger text-sm">Create an organization to manage users.</p>
    }
    if (isError) {
        return <p className="text-danger text-sm">Failed to load user management.</p>
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UsersManagement authToken={token} />
        </WorkOsWidgets>
    )
}
