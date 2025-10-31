import { AnimatePresence } from "framer-motion";
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Spin from "./components/loading/Spin";
import { AppSidebar } from "./components/Sidebar";
import { IntegrationProvider } from "./context/Integrations";
import ActivityFeed from "./pages/ActivityFeed";
import Automations from "./pages/Automations/Automations";
import AutomationsList from "./pages/Automations/AutomationsList";
import Home from "./pages/Home";
import LandingPageChangelog from "./pages/LandingPage_changelog";
import Login from "./pages/Login";
import OAuthError from "./pages/OAuthError";
import OAuthSuccess from "./pages/OAuthSuccess";
import { AuthProvider, useAuth } from "./services/auth";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<Content />}>
            <Route index element={<Home />} />
            <Route path="activity" element={<ActivityFeed />} />
            <Route path="automations" element={<AutomationsList />} />
            <Route path="automations/new" element={<Automations />} />
            <Route path="automations/:id" element={<Automations />} />
          </Route>
          <Route path="/changelog" element={<LandingPageChangelog />} />
          <Route path="/oauth/success" element={<OAuthSuccess />} />
          <Route path="/oauth/error" element={<OAuthError />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

function Content() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <Spin />;
  }

  // If user is not part of an organization, redirect to onboarding
  if (user != null && user.is_placeholder) {
    window.location.href = '/onboard';
  }

  return (
    <>
      <IntegrationProvider>
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
      </IntegrationProvider>
    </>
  );
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <SidebarTrigger />
        <Outlet />
      </main>
    </SidebarProvider>
  )
}

export default App