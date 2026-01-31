import { UserSecurity, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';
import { BackendProvider } from '@/services/backend';
import { SocketEvents } from '@/shared/SocketEvents';
import { getWorkOsThemeConfig, workOsWidgetElements, useResolvedAppearance } from '@/hooks/useWorkOsTheme';

export function UserSecurityWidget() {
    const appearance = useResolvedAppearance();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchToken = () => {
        BackendProvider.getWidgetToken()
            .then((data) => setAuthToken(data.token))
            .catch((err) => {
                console.error('Failed to get widget token:', err);
                setError(err.response?.data?.error ?? 'Failed to load security settings.');
            });
    };

    useEffect(() => {
        fetchToken();
    }, []);

    useEffect(() => {
        const handleUpdate = () => fetchToken();
        window.addEventListener(SocketEvents.WORKOS_USER_UPDATED, handleUpdate);
        return () => window.removeEventListener(SocketEvents.WORKOS_USER_UPDATED, handleUpdate);
    }, []);

    if (error) {
        return <p className="text-destructive text-sm">{error}</p>;
    }
    if (!authToken) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UserSecurity authToken={authToken} />
        </WorkOsWidgets>
    );
}
