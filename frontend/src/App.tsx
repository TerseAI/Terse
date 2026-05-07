import { useEffect } from "react"
import { Link, Navigate, Outlet, Route, BrowserRouter as Router, Routes, useNavigate } from "react-router-dom"

import { AnimatePresence } from "framer-motion"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import BreadCrumb from "./components/BreadCrumb"
import { AppSidebar } from "./components/Sidebar/Sidebar"
import AppBootScreen from "./components/loading/AppBootScreen"
import { ThemeProvider } from "./components/theme-provider"
import { Button } from "./components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "./components/ui/empty"
import { SidebarProvider } from "./components/ui/sidebar"
import { Toaster } from "./components/ui/sonner"
import { POST_LOGIN_REDIRECT_KEY, isSafeRedirectPath } from "./constants/storageKeys"
import ActivityPage from "./pages/Activity"
import AgentDetail from "./pages/Agents/AgentDetail"
import ApiTokensPage from "./pages/ApiTokens"
import BillingPage from "./pages/BillingPage"
import HomePage from "./pages/Home"
import IntegrationPage from "./pages/IntegrationPage"
import NotificationsPage from "./pages/Notifications"
import OAuthError from "./pages/OAuthError"
import OAuthSuccess from "./pages/OAuthSuccess"
import OrganizationCreationPage from "./pages/OrganizationCreationPage"
import PricingPage from "./pages/PricingPage"
import ProfilePage from "./pages/ProfilePage"
import ProjectDeploysPage from "./pages/Projects/ProjectDeploysPage"
import ProjectDetail from "./pages/Projects/ProjectDetail"
import StatsPage from "./pages/Stats"
import { RunHistoryChatDrawerProvider } from "./services/RunHistoryChatDrawerContext"
import { AuthProvider, useAuth } from "./services/auth"
import { disconnectSocket, initializeSocket } from "./socket"

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <Toaster position="top-center" richColors={true} />
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/" element={<Navigate to={FrontendRoutes.APP} replace />} />
                        <Route path="/pricing" element={<Navigate to={FrontendRoutes.PRICING} replace />} />
                        <Route path={FrontendRoutes.APP} element={<Content />}>
                            <Route index element={<Navigate to="home" replace />} />
                            <Route path="home" element={<HomePage />} />
                            <Route path="pricing" element={<PricingPage />} />
                            <Route path="agents/new" element={<AgentDetail />} />
                            <Route path={FrontendRoutes.AGENTS.NEW_WITH_TEMPLATE} element={<AgentDetail />} />
                            <Route path={FrontendRoutes.AGENTS.BY_ID} element={<AgentDetail />} />
                            <Route path={FrontendRoutes.PROJECTS.BY_ID} element={<ProjectDetail />} />
                            <Route path={FrontendRoutes.PROJECTS.DEPLOYS} element={<ProjectDeploysPage />} />
                            <Route path="activity" element={<ActivityPage />} />
                            <Route path="stats" element={<StatsPage />} />
                            <Route path="integrations" element={<IntegrationPage />} />
                            <Route path="notifications" element={<NotificationsPage />} />
                            <Route path="api-tokens" element={<ApiTokensPage />} />
                            <Route element={<RequireAdminOutlet />}>
                                <Route path="billing" element={<BillingPage />} />
                            </Route>
                            <Route path="profile" element={<ProfilePage />} />
                        </Route>
                        <Route path={FrontendRoutes.ORGANIZATIONS.CREATE} element={<OrganizationCreationPage />} />
                        <Route path={FrontendRoutes.OAUTH.SUCCESS} element={<OAuthSuccess />} />
                        <Route path={FrontendRoutes.OAUTH.ERROR} element={<OAuthError />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    )
}

function Content() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()

    // Initialize socket when user is authenticated
    useEffect(() => {
        if (user && user != null) {
            initializeSocket()
        } else {
            disconnectSocket()
        }

        // Cleanup on unmount
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

    // If user is not part of an organization, redirect to org creation
    if (user != null && !user.organizationId) {
        return <Navigate to={FrontendRoutes.ORGANIZATIONS.CREATE} replace />
    }

    return (
        <>
            <AnimatePresence mode="wait">
                {user != null ? (
                    <div key="main" className="h-full">
                        <AppLayout />
                    </div>
                ) : (
                    <AppBootScreen key="redirecting" />
                )}
            </AnimatePresence>
        </>
    )
}

function AppLayout() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 flex flex-col h-full min-w-0 bg-background">
                <BreadCrumb />
                <div className="flex-1 min-h-0">
                    <RunHistoryChatDrawerProvider>
                        <Outlet />
                    </RunHistoryChatDrawerProvider>
                </div>
            </main>
        </SidebarProvider>
    )
}

function RequireAdminOutlet() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <AppBootScreen />
    }

    if (!user?.roles.includes("admin")) {
        return <Navigate to={FrontendRoutes.HOME} replace />
    }

    return <Outlet />
}

function NotFoundPage() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center bg-background p-6">
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Page not found</EmptyTitle>
                    <EmptyDescription>This URL doesn&apos;t match anything in the app. Check the link or return to Home.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button asChild>
                        <Link to={FrontendRoutes.HOME}>Back to Home</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    )
}

export default App
