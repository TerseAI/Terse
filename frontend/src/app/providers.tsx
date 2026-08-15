import { ReactNode } from "react"

import { ThemeProvider } from "next-themes"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/modules/auth/context/AuthProvider"

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="vite-ui-theme" disableTransitionOnChange>
            <Toaster position="top-center" richColors={true} />
            <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
    )
}
