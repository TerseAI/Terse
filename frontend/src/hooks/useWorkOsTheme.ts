import { useTheme } from "next-themes"

const WORKOS_FONT_FAMILY =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'

/** WorkOS widgets need a concrete appearance, so system resolves to light until next-themes reports. */
export function useResolvedAppearance(): "dark" | "light" {
    const { resolvedTheme } = useTheme()
    return resolvedTheme === "dark" ? "dark" : "light"
}

export type WorkOsThemeConfig = {
    appearance: "dark" | "light"
    accentColor: "gray"
    grayColor: "gray"
    radius: "medium"
    hasBackground: false
    panelBackground: "solid"
    fontFamily: string
}

export function getWorkOsThemeConfig(appearance: "dark" | "light"): WorkOsThemeConfig {
    return {
        appearance,
        accentColor: "gray",
        grayColor: "gray",
        radius: "medium",
        hasBackground: false,
        panelBackground: "solid",
        fontFamily: WORKOS_FONT_FAMILY
    }
}

export const workOsWidgetElements = {
    primaryButton: { highContrast: true as const },
    dialog: { size: "3" as const }
}
