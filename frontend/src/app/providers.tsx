import { ReactNode } from "react"

import { ThemeProvider } from "next-themes"

import { ThemeColorMeta } from "@/components/ThemeColorMeta"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/modules/auth/context/AuthProvider"

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="vite-ui-theme" disableTransitionOnChange>
            <ThemeColorMeta />
            <Toaster position="top-center" richColors={true} />
            <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
    )
}
