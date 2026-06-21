import { ReactNode } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/modules/auth/context/AuthProvider"

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <Toaster position="top-center" richColors={true} />
            <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
    )
}
