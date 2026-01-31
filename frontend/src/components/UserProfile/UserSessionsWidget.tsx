import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '@/hooks/useWorkOsTheme';
import { BackendProvider } from '@/services/backend';
import { UserSessions, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';

export function UserSessionsWidget() {
    const appearance = useResolvedAppearance();
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        BackendProvider.getWidgetToken()
            .then(() => setReady(true))
            .catch((err) => {
                console.error('Failed to get widget token:', err);
                setError(err.response?.data?.error ?? 'Failed to load sessions.');
            });
    }, []);

    if (error) {
        return <p className="text-destructive text-sm">{error}</p>;
    }
    if (!ready) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    const getAccessToken = () => BackendProvider.getWidgetToken().then((data) => data.token);

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserSessions authToken={getAccessToken} />
        </WorkOsWidgets>
    );
}
