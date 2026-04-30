/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect } from "react"

import { AxiosError } from "axios"
import { posthog } from "posthog-js"
import { mutate } from "swr"

import { POST_LOGIN_REDIRECT_KEY } from "../constants/storageKeys"
import { useCurrentUser } from "../hooks/api/useCurrentUser"
import { emitAuthEvent, onAuthEvent } from "../lib/authEvents"
import { disconnectSocket } from "../socket"
import type { User } from "../types/User"

import { BackendProvider } from "./backend"

interface AuthContextType {
    user: User | null
    isLoading: boolean
    logout: () => void
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Logout listeners (registered once at module load) ───────────────────────

// Reset PostHog so the next user isn't associated with the old identity
onAuthEvent("logout", () => {
    posthog.reset()
})

// Clear the entire SWR in-memory cache (user data, agents, orgs, etc.)
onAuthEvent("logout", () => {
    void mutate(() => true, undefined, { revalidate: false })
})

// Remove stale post-login redirect key
onAuthEvent("logout", () => {
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
})

// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading, error, mutate } = useCurrentUser()

    // Handle 401 redirect
    useEffect(() => {
        if (error instanceof AxiosError && error.response?.status === 401) {
            BackendProvider.loginRedirect()
        }
    }, [error])

    // PostHog identification
    useEffect(() => {
        if (user) {
            posthog.identify(user.id, {
                email: user.email,
                displayName: user.displayName
            })
            posthog.setPersonPropertiesForFlags({ email: user.email })
        }
    }, [user])

    function logout() {
        disconnectSocket()
        emitAuthEvent("logout")
        void BackendProvider.logoutRedirect()
    }

    async function refreshUser() {
        await mutate()
    }

    return <AuthContext.Provider value={{ user, isLoading, logout, refreshUser }}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
