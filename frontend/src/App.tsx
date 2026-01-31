import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import BreadCrumb from "./components/BreadCrumb";
import Spin from "./components/loading/Spin";
import { AppSidebar } from "./components/Sidebar/Sidebar";
import { ThemeProvider } from "./components/theme-provider";
import { SidebarProvider } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import AgentDetail from "./pages/Agents/AgentDetail";
import AgentSetup from "./pages/Agents/AgentSetup";
import AgentsList from "./pages/Agents/AgentsList";
import Home from "./pages/Home";
import IntegrationPage from "./pages/IntegrationPage";
import NotificationsPage from "./pages/Notifications";
import OAuthError from "./pages/OAuthError";
import OAuthSuccess from "./pages/OAuthSuccess";
import OrganizationCreationPage from "./pages/OrganizationCreationPage";
import ProfilePage from "./pages/ProfilePage";
import { AuthProvider, useAuth } from "./services/auth";
import { FrontendRoutes } from "./shared/FrontendRoutes";
import { ModelContextProvider } from "./services/ModelContextProvider";
import { disconnectSocket, initializeSocket } from "./socket";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster position="top-center" richColors={true} />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to={FrontendRoutes.APP} replace />} />
            <Route path={FrontendRoutes.APP} element={<Content />}>
              <Route index element={<Home />} />
              <Route path="agents" element={<AgentsList />} />
              <Route path="agents/setup" element={<AgentSetup />} />
              <Route path="agents/new" element={<AgentDetail />} />
              <Route path={FrontendRoutes.AGENTS.NEW_WITH_TEMPLATE.pattern} element={<AgentDetail />} />
              <Route path={FrontendRoutes.AGENTS.BY_ID.pattern} element={<AgentDetail />} />
              <Route path="integrations" element={<IntegrationPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
            <Route path={FrontendRoutes.ORGANIZATIONS.CREATE} element={<OrganizationCreationPage />} />
            <Route path={FrontendRoutes.OAUTH.SUCCESS} element={<OAuthSuccess />} />
            <Route path={FrontendRoutes.OAUTH.ERROR} element={<OAuthError />} />
            <Route path="*" element={<div>Not Found</div>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

function Content() {
  const { user, isLoading } = useAuth()

  // Initialize socket when user is authenticated
  useEffect(() => {
    if (user && user != null) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    // Cleanup on unmount
    return () => {
      disconnectSocket();
    };
  }, [user]);

  if (isLoading) {
    return <Spin />;
  }

  // If user is not part of an organization, redirect to org creation
  if (user != null && !user.organizationId) {
    return <Navigate to={FrontendRoutes.ORGANIZATIONS.CREATE} replace />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {user != null ? (
          <div key="main" className="h-full">
            <AppLayout />
          </div>
        ) : (
          <div key="redirecting" className="h-full grid place-items-center">
            <Spin />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 bg-background">
        <BreadCrumb />
        <div className="flex-1 min-h-0">
          <ModelContextProvider>
            <Outlet />
          </ModelContextProvider>
        </div>
      </main>
    </SidebarProvider>
  )
}

export default App