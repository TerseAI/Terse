import { OrganizationSwitcher, WorkOsWidgets } from "@workos-inc/widgets"

import { useUserOrganizations } from "@/hooks/api/useUserOrganizations"
import { useWidgetToken } from "@/hooks/api/useWidgetToken"
import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from "@/hooks/useWorkOsTheme"
import { BackendProvider } from "@/services/backend"

export function OrganizationSwitcherWidget() {
    const appearance = useResolvedAppearance()
    const { token, isLoading: isLoadingToken } = useWidgetToken()
    const { organizations, isLoading: isLoadingOrgs } = useUserOrganizations()

    if (isLoadingToken || isLoadingOrgs) {
        return null
    }

    if (organizations.length <= 1 || !token) {
        return null
    }

    const handleSwitch = async ({ organizationId }: { organizationId: string }) => {
        try {
            const response = await BackendProvider.switchOrganization(organizationId)
            if (response.redirectUrl) {
                window.location.href = response.redirectUrl
            } else {
                window.location.reload()
            }
        } catch (err: unknown) {
            const e = err as { redirectUrl?: string }
            if (e?.redirectUrl) {
                window.location.href = e.redirectUrl
            } else {
                window.location.reload()
            }
        }
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <OrganizationSwitcher authToken={token} switchToOrganization={handleSwitch} />
        </WorkOsWidgets>
    )
}
