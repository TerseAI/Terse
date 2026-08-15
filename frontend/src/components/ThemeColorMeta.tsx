import { useEffect } from "react"

import { useTheme } from "next-themes"

/**
 * Keeps the browser chrome in step with the app theme. index.html sets this tag once at boot from
 * hardcoded hex, since it runs before the stylesheet; here the live token is available, so read it.
 */
export function ThemeColorMeta() {
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        const tag = document.querySelector('meta[name="theme-color"]')
        if (!tag) return

        // next-themes writes the class in its own effect, so read the token after the commit lands.
        const frame = requestAnimationFrame(() => {
            const background = getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
            if (background) tag.setAttribute("content", background)
        })

        return () => cancelAnimationFrame(frame)
    }, [resolvedTheme])

    return null
}
