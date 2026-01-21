import { AnimatePresence } from "framer-motion";
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { useEffect } from "react";
import Spin from "./components/loading/Spin";
import { AppSidebar } from "./components/Sidebar/Sidebar";
import ActivityFeed from "./pages/ActivityFeed";
import ChannelDetail from "./pages/Channels/ChannelDetail";
import ChannelsList from "./pages/Channels/ChannelsList";
import ChannelSetup from "./pages/Channels/ChannelSetup";
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

function App() {
  const hasBirdsEyeFlag = useFeatureFlag('Birds-eye-view-homepage');
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster position="top-center" richColors={true} />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<Content />}>
              <Route index element={ hasBirdsEyeFlag ? <BirdsEyeViewHomepage /> : <Home />} />
              <Route path="activity" element={<ActivityFeed />} />
              <Route path="agents" element={<ChannelsList />} />
              <Route path="agents/setup" element={<ChannelSetup />} />
              <Route path="agents/new" element={<ChannelDetail />} />
              <Route path="agents/new/template/:templateId" element={<ChannelDetail />} />
              <Route path="agents/:id" element={<ChannelDetail />} />
              <Route path="integrations" element={<IntegrationPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>
            <Route path="/changelog" element={<LandingPageChangelog />} />
            <Route path="/oauth/success" element={<OAuthSuccess />} />
            <Route path="/oauth/error" element={<OAuthError />} />
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
    window.location.href = '/onboard';
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
      <main className="w-full">
        <BreadCrumb />
        <Outlet />
      </main>
    </SidebarProvider>
  )
}

export default App