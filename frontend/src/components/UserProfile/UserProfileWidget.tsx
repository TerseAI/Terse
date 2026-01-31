import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '@/hooks/useWorkOsTheme';
import { BackendProvider } from '@/services/backend';
import { SocketEvents } from '@/shared/SocketEvents';
import { UserProfile, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';

export function UserProfileWidget() {
    const appearance = useResolvedAppearance();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchToken = () => {
        BackendProvider.getWidgetToken()
            .then((data) => setAuthToken(data.token))
            .catch((err) => {
                console.error('Failed to get widget token:', err);
                setError(err.response?.data?.error ?? 'Failed to load profile.');
            });
    };

    useEffect(() => {
        fetchToken();
    }, []);

    useEffect(() => {
        const handleUpdate = () => {
            console.log('[UserProfileWidget] Received WORKOS_USER_UPDATED, refreshing widget token');
            fetchToken();
        };
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
            <UserProfile authToken={authToken} />
        </WorkOsWidgets>
    );
}
