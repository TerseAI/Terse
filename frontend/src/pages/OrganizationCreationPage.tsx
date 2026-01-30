import { Navigate } from "react-router-dom";
import OrganizationCreationForm from "../components/UserManagement/OrganizationCreationForm";
import { useAuth } from "../services/auth";
import { FrontendRoutes } from "../shared/FrontendRoutes";

export default function OrganizationCreationPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    // If user already has an organization, redirect to app
    if (user?.organizationId) {
        return <Navigate to={FrontendRoutes.APP} replace />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <OrganizationCreationForm />
        </div>
    );
}