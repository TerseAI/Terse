import { Navigate, Outlet } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import AppBootScreen from "@/components/loading/AppBootScreen"
import { useAuth } from "@/modules/auth/context/AuthProvider"

export function RequireAdminOutlet() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <AppBootScreen />
    }

    if (!user?.roles.includes("admin")) {
        return <Navigate to={FrontendRoutes.HOME} replace />
    }

    return <Outlet />
}
