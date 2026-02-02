import { UserSecurity, WorkOsWidgets } from '@workos-inc/widgets';
import { getWorkOsThemeConfig, workOsWidgetElements, useResolvedAppearance } from '@/hooks/useWorkOsTheme';
import { useWidgetToken } from '@/hooks/api/useWidgetToken';

export function UserSecurityWidget() {
    const appearance = useResolvedAppearance();
    const { token, isLoading, isError } = useWidgetToken();

    if (isError) {
        return <p className="text-destructive text-sm">Failed to load security settings.</p>;
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserSecurity authToken={token} />
        </WorkOsWidgets>
    );
}
