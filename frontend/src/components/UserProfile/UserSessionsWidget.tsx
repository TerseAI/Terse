import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '@/hooks/useWorkOsTheme';
import { BackendProvider } from '@/services/backend';
import { useWidgetToken } from '@/hooks/api/useWidgetToken';
import { UserSessions, WorkOsWidgets } from '@workos-inc/widgets';

export function UserSessionsWidget() {
    const appearance = useResolvedAppearance();
    const { token, isLoading, isError } = useWidgetToken();

    const getAccessToken = () => BackendProvider.getWidgetToken().then((d) => d.token);

    if (isError) {
        return <p className="text-destructive text-sm">Failed to load sessions.</p>;
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserSessions authToken={getAccessToken} />
        </WorkOsWidgets>
    );
}
