import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '@/hooks/useWorkOsTheme';
import { BackendProvider } from '@/services/backend';
import { SocketEvents } from '@/shared/SocketEvents';
import { UserSessions, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';

export function UserSessionsWidget() {
    const appearance = useResolvedAppearance();
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [refreshKey, setRefreshKey] = useState(0);

    const fetchToken = () => {
        BackendProvider.getWidgetToken()
            .then(() => {
                setReady(true);
                setRefreshKey((k) => k + 1);
            })
            .catch((err) => {
                console.error('Failed to get widget token:', err);
                setError(err.response?.data?.error ?? 'Failed to load sessions.');
            });
    };

    useEffect(() => {
        fetchToken();
    }, []);

    useEffect(() => {
        const handleUpdate = () => fetchToken();
        window.addEventListener(SocketEvents.WORKOS_USER_UPDATED, handleUpdate);
        window.addEventListener(SocketEvents.WORKOS_SESSION_UPDATED, handleUpdate);
        return () => {
            window.removeEventListener(SocketEvents.WORKOS_USER_UPDATED, handleUpdate);
            window.removeEventListener(SocketEvents.WORKOS_SESSION_UPDATED, handleUpdate);
        };
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
            <UserSessions key={refreshKey} authToken={getAccessToken} />
        </WorkOsWidgets>
    );
}
