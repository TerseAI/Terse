import { Navigate, Route, Routes } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { AppGate } from "@/app/AppGate"
import { RequireAdminOutlet } from "@/app/layouts/RequireAdminOutlet"
import ActivityPage from "@/pages/ActivityPage"
import AgentDetailPage from "@/pages/AgentDetailPage"
import ApiTokensPage from "@/pages/ApiTokensPage"
import BillingPage from "@/pages/BillingPage"
import HomePage from "@/pages/HomePage"
import IntegrationsPage from "@/pages/IntegrationsPage"
import NotFoundPage from "@/pages/NotFoundPage"
import NotificationsPage from "@/pages/NotificationsPage"
import OAuthErrorPage from "@/pages/OAuthErrorPage"
import OAuthSuccessPage from "@/pages/OAuthSuccessPage"
import OrganizationCreationPage from "@/pages/OrganizationCreationPage"
import PricingPage from "@/pages/PricingPage"
import ProfilePage from "@/pages/ProfilePage"
import ProjectDeploysPage from "@/pages/ProjectDeploysPage"
import ProjectDetailPage from "@/pages/ProjectDetailPage"
import StatsPage from "@/pages/StatsPage"

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to={FrontendRoutes.APP} replace />} />
            <Route path="/pricing" element={<Navigate to={FrontendRoutes.PRICING} replace />} />
            <Route path={FrontendRoutes.APP} element={<AppGate />}>
                <Route index element={<Navigate to="home" replace />} />
                <Route path="home" element={<HomePage />} />
                <Route path="pricing" element={<PricingPage />} />
                <Route path={FrontendRoutes.JOBS.BY_ID} element={<AgentDetailPage />} />
                <Route path={FrontendRoutes.PROJECTS.BY_ID} element={<ProjectDetailPage />} />
                <Route path={FrontendRoutes.PROJECTS.DEPLOYS} element={<ProjectDeploysPage />} />
                <Route path="activity" element={<ActivityPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="api-tokens" element={<ApiTokensPage />} />
                <Route element={<RequireAdminOutlet />}>
                    <Route path="billing" element={<BillingPage />} />
                </Route>
                <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path={FrontendRoutes.ORGANIZATIONS.CREATE} element={<OrganizationCreationPage />} />
            <Route path={FrontendRoutes.OAUTH.SUCCESS} element={<OAuthSuccessPage />} />
            <Route path={FrontendRoutes.OAUTH.ERROR} element={<OAuthErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    )
}
