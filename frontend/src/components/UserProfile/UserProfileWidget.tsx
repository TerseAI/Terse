import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '@/hooks/useWorkOsTheme';
import { useWidgetToken } from '@/hooks/api/useWidgetToken';
import { UserProfile, WorkOsWidgets } from '@workos-inc/widgets';

export function UserProfileWidget() {
    const appearance = useResolvedAppearance();
    const { token, isLoading, isError } = useWidgetToken();

    if (isError) {
        return <p className="text-destructive text-sm">Failed to load profile.</p>;
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserProfile authToken={token} />
        </WorkOsWidgets>
    );
}
