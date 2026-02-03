import { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme-provider';

const WORKOS_FONT_FAMILY =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/** Resolved light/dark for WorkOS theme (handles system preference). */
export function useResolvedAppearance(): 'dark' | 'light' {
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

export type WorkOsThemeConfig = {
    appearance: 'dark' | 'light';
    accentColor: 'gray';
    grayColor: 'gray';
    radius: 'medium';
    hasBackground: false;
    panelBackground: 'solid';
    fontFamily: string;
};

export function getWorkOsThemeConfig(appearance: 'dark' | 'light'): WorkOsThemeConfig {
    return {
        appearance,
        accentColor: 'gray',
        grayColor: 'gray',
        radius: 'medium',
        hasBackground: false,
        panelBackground: 'solid',
        fontFamily: WORKOS_FONT_FAMILY,
    };
}

export const workOsWidgetElements = {
    primaryButton: { highContrast: true as const },
    dialog: { size: '3' as const },
};
