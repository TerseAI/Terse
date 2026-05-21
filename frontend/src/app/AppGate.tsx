import { useEffect } from "react"
import { Navigate, useNavigate } from "react-router-dom"

import { AnimatePresence } from "framer-motion"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { AppLayout } from "@/app/layouts/AppLayout"
import AppBootScreen from "@/components/loading/AppBootScreen"
import { POST_LOGIN_REDIRECT_KEY, isSafeRedirectPath } from "@/constants/storageKeys"
import { disconnectSocket, initializeSocket } from "@/lib/socket"
import { useAuth } from "@/modules/auth/context/AuthProvider"

export function AppGate() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user && user != null) {
            initializeSocket()
        } else {
            disconnectSocket()
        }

        return () => {
            disconnectSocket()
        }
    }, [user])

    useEffect(() => {
        if (!user?.organizationId) {
            return
        }

        const storedRedirect = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
        if (!storedRedirect || !isSafeRedirectPath(storedRedirect)) {
            if (storedRedirect) localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
            return
        }

        localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
        navigate(storedRedirect, { replace: true })
    }, [navigate, user?.organizationId])

    if (isLoading) {
        return <AppBootScreen />
    }

    if (user != null && !user.organizationId) {
        return <Navigate to={FrontendRoutes.ORGANIZATIONS.CREATE} replace />
    }

    return (
        <AnimatePresence mode="wait">
            {user != null ? (
                <div key="main" className="h-full">
                    <AppLayout />
                </div>
            ) : (
                <AppBootScreen key="redirecting" />
            )}
        </AnimatePresence>
    )
}
