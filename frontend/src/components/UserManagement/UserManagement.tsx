import { UsersManagement, WorkOsWidgets } from '@workos-inc/widgets';
import { useEffect, useState } from 'react';
import { useAuth } from '../../services/auth';
import { BackendProvider } from '../../services/backend';
import { useTheme } from '../theme-provider';

/** Resolved light/dark for WorkOS theme (handles system preference). */
function useResolvedAppearance(): 'dark' | 'light' {
    const { theme } = useTheme();
    const [resolved, setResolved] = useState<'dark' | 'light'>(() => {
        if (theme === 'dark') return 'dark';
        if (theme === 'light') return 'light';
        return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        if (theme === 'dark') {
            setResolved('dark');
            return;
        }
        if (theme === 'light') {
            setResolved('light');
            return;
        }
        const m = window.matchMedia('(prefers-color-scheme: dark)');
        const update = () => setResolved(m.matches ? 'dark' : 'light');
        update();
        m.addEventListener('change', update);
        return () => m.removeEventListener('change', update);
    }, [theme]);

    return resolved;
}

export function UserTable() {
    const { user } = useAuth();
    const appearance = useResolvedAppearance();
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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

    if (error) {
        return <p className="text-destructive text-sm">{error}</p>;
    }
    if (!authToken) {
        return <p className="text-muted-foreground text-sm">Loading…</p>;
    }

    // Tailwind's default system font stack
    const fontFamily =
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

    return (
        <WorkOsWidgets
            theme={{
                appearance,
                accentColor: 'gray',
                grayColor: 'gray',
                radius: 'medium',
                hasBackground: false,
                panelBackground: 'solid',
                fontFamily,
            }}
            elements={{
                primaryButton: {
                    highContrast: true,
                },
                dialog: {
                    size: '3',
                },
            }}
        >
            <UsersManagement authToken={authToken} />
        </WorkOsWidgets>
    );
}