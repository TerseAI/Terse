import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    resolvedTheme: "dark" | "light"
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    resolvedTheme: "light",
    setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "vite-ui-theme", ...props }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(storageKey) as Theme) || defaultTheme)
    const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"))
    const resolvedTheme = theme === "system" ? systemTheme : theme

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)")
        const handleChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light")

        media.addEventListener("change", handleChange)
        return () => media.removeEventListener("change", handleChange)
    }, [])

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")
        root.classList.add(resolvedTheme)
        root.style.colorScheme = resolvedTheme

        const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
        if (themeColor) {
            themeColor.content = resolvedTheme === "dark" ? "#1a1715" : "#f9f6f2"
        }
    }, [resolvedTheme])

    const value = {
        theme,
        resolvedTheme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        }
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
