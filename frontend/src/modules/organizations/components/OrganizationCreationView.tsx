import { useNavigate } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { useAuth } from "@/modules/auth/context/AuthProvider"
import OrganizationCreationForm from "@/modules/organizations/components/OrganizationCreationForm"

export default function OrganizationCreationPage() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()

    if (!user || user.organizationId) {
        navigate(FrontendRoutes.HOME, { replace: true })
    }

    if (isLoading) {
        return null
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <OrganizationCreationForm />
        </div>
    )
}
