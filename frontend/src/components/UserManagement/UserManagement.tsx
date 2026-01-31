import { UsersManagement, WorkOsWidgets } from '@workos-inc/widgets';
import { useCallback, useEffect, useState } from 'react';
import { getWorkOsThemeConfig, useResolvedAppearance, workOsWidgetElements } from '../../hooks/useWorkOsTheme';
import { useAuth } from '../../services/auth';
import { BackendProvider } from '../../services/backend';
import { SocketEvents } from '../../shared/SocketEvents';

export function UserTable() {
    const { user } = useAuth();
    const appearance = useResolvedAppearance();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchToken = useCallback(() => {
        if (!user?.organizationId) {
            setError('Create an organization to manage users.');
            return;
        }
        BackendProvider.getWidgetToken()
            .then((data) => setAuthToken(data.token))
            .catch((err) => {
                console.error('Failed to get widget token:', err);
                setError(err.response?.data?.error ?? 'Failed to load user management.');
            });
    }, [user?.organizationId]);

    useEffect(() => {
        fetchToken();
    }, [fetchToken]);

    useEffect(() => {
        const handleUpdate = () => fetchToken();
        window.addEventListener(SocketEvents.WORKOS_ORG_UPDATED, handleUpdate);
        return () => window.removeEventListener(SocketEvents.WORKOS_ORG_UPDATED, handleUpdate);
    }, [fetchToken]);

    if (error) {
        return <p className="text-destructive text-sm">{error}</p>;
    }
    if (!authToken) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    return (
        <WorkOsWidgets theme={getWorkOsThemeConfig(appearance)} elements={workOsWidgetElements}>
            <UsersManagement authToken={authToken} />
        </WorkOsWidgets>
    );
}