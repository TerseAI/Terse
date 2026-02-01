import { UsersManagement, WorkOsWidgets } from '@workos-inc/widgets';
import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '../../hooks/useWorkOsTheme';
import { useAuth } from '../../services/auth';
import { useWidgetToken } from '@/hooks/api/useWidgetToken';

export function UserTable() {
    const { user } = useAuth();
    const appearance = useResolvedAppearance();
    const { token, isLoading, isError } = useWidgetToken();

    if (user && !user.organizationId) {
        return <p className="text-destructive text-sm">Create an organization to manage users.</p>;
    }
    if (isError) {
        return <p className="text-destructive text-sm">Failed to load user management.</p>;
    }
    if (isLoading || !token) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UsersManagement authToken={token} />
        </WorkOsWidgets>
    );
}
