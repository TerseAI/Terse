import { Navigate } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { useAuth } from "@/modules/auth/context/AuthProvider"
import OrganizationCreationForm from "@/modules/organizations/components/OrganizationCreationForm"

export default function OrganizationCreationPage() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return null
    }

    if (!user || user.organizationId) {
        return <Navigate to={FrontendRoutes.HOME} replace />
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <OrganizationCreationForm />
        </div>
    )
}
