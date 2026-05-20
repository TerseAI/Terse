import { useNavigate } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import OrganizationCreationForm from "../components/UserManagement/OrganizationCreationForm"
import { useAuth } from "../services/auth"

export default function OrganizationCreationPage() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()

    if (!user || user.organizationId) {
        navigate(FrontendRoutes.APP, { replace: true })
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
