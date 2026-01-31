import { OrganizationSwitcher, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';
import { BackendProvider } from '@/services/backend';
import { getWorkOsThemeConfig, workOsWidgetElements, useResolvedAppearance } from '@/hooks/useWorkOsTheme';

export function OrganizationSwitcherWidget() {
    const appearance = useResolvedAppearance();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            BackendProvider.getUserOrganizations(),
            BackendProvider.getWidgetToken(),
        ])
            .then(([orgsRes, tokenRes]) => {
                setOrganizations(orgsRes.organizations);
                setAuthToken(tokenRes.token);
            })
            .catch((err) => {
                console.error('Failed to load organizations or widget token:', err);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return null;
    }

    if (organizations.length <= 1 || !authToken) {
        return null;
    }

    const handleSwitch = async ({ organizationId }: { organizationId: string }) => {
        try {
            const response = await BackendProvider.switchOrganization(organizationId);
            if (response.redirectUrl) {
                window.location.href = response.redirectUrl;
            } else {
                window.location.reload();
            }
        } catch (err: unknown) {
            const e = err as { redirectUrl?: string };
            if (e?.redirectUrl) {
                window.location.href = e.redirectUrl;
            } else {
                window.location.reload();
            }
        }
    };

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <OrganizationSwitcher
                authToken={authToken}
                switchToOrganization={handleSwitch}
            />
        </WorkOsWidgets>
    );
}
