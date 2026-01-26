import { AnimatePresence } from "framer-motion";
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { useEffect } from "react";
import Spin from "./components/loading/Spin";
import { AppSidebar } from "./components/Sidebar/Sidebar";
import ActivityFeed from "./pages/ActivityFeed";
import AgentDetail from "./pages/Agents/AgentDetail";
import AgentsList from "./pages/Agents/AgentsList";
import AgentSetup from "./pages/Agents/AgentSetup";
import BirdsEyeViewHomepage from "./pages/BirdsEye";
import Home from "./pages/Home";
import LandingPageChangelog from "./pages/LandingPage_changelog";
import Login from "./pages/Login";
import OAuthError from "./pages/OAuthError";
import OAuthSuccess from "./pages/OAuthSuccess";
import { AuthProvider, useAuth } from "./services/auth";
import { SidebarProvider } from "./components/ui/sidebar";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import IntegrationPage from "./pages/IntegrationPage";
import BreadCrumb from "./components/BreadCrumb";
import { initializeSocket, disconnectSocket } from "./socket";
import { useFeatureFlag } from "./hooks/useFeatureFlag";
import NotificationsPage from "./pages/Notifications";
import { FrontendRoutes } from "./shared/FrontendRoutes";
import { ModelContextProvider } from "./services/ModelContextProvider";

function App() {
  const hasBirdsEyeFlag = useFeatureFlag('Birds-eye-view-homepage');
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster position="top-center" richColors={true} />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to={FrontendRoutes.APP} replace />} />
            <Route path={FrontendRoutes.APP} element={<Content />}>
              <Route index element={hasBirdsEyeFlag ? <BirdsEyeViewHomepage /> : <Home />} />
              <Route path="activity" element={<ActivityFeed />} />
              <Route path="agents" element={<AgentsList />} />
              <Route path="agents/setup" element={<AgentSetup />} />
              <Route path="agents/new" element={<AgentDetail />} />
              <Route path={FrontendRoutes.AGENTS.NEW_WITH_TEMPLATE.pattern} element={<AgentDetail />} />
              <Route path={FrontendRoutes.AGENTS.BY_ID.pattern} element={<AgentDetail />} />
              <Route path="integrations" element={<IntegrationPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
            <Route path="/changelog" element={<LandingPageChangelog />} />
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

  // If user is not part of an organization, redirect to onboarding
  if (user != null && user.is_placeholder) {
    window.location.href = FrontendRoutes.ONBOARD;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {user != null ? (
          <div key="main" className="h-full">
            <AppLayout />
          </div>
        ) : (
          <div key="login">
            <Login />
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