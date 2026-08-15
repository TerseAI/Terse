import { Suspense, lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { AppGate } from "@/app/AppGate"
import { RequireAdminOutlet } from "@/app/layouts/RequireAdminOutlet"
import AppBootScreen from "@/components/loading/AppBootScreen"
import { ACTIVITY_OVERVIEW_PATH } from "@/modules/activity/activityRoutes"

const ActivityPage = lazy(() => import("@/pages/ActivityPage"))
const AgentDetailPage = lazy(() => import("@/pages/AgentDetailPage"))
const ApiTokensPage = lazy(() => import("@/pages/ApiTokensPage"))
const BillingPage = lazy(() => import("@/pages/BillingPage"))
const HomePage = lazy(() => import("@/pages/HomePage"))
const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"))
const OAuthErrorPage = lazy(() => import("@/pages/OAuthErrorPage"))
const OAuthSuccessPage = lazy(() => import("@/pages/OAuthSuccessPage"))
const OrganizationCreationPage = lazy(() => import("@/pages/OrganizationCreationPage"))
const PricingPage = lazy(() => import("@/pages/PricingPage"))
const ProfilePage = lazy(() => import("@/pages/ProfilePage"))
const ProjectDeploysPage = lazy(() => import("@/pages/ProjectDeploysPage"))
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"))

export function AppRoutes() {
    return (
        <Suspense fallback={<AppBootScreen revealAfterMs={150} />}>
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
                    <Route path="stats" element={<Navigate to={ACTIVITY_OVERVIEW_PATH} replace />} />
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
        </Suspense>
    )
}
