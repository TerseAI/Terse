import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./services/auth";
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { IntegrationProvider } from "./context/Integrations";
import LandingPageChangelog from "./pages/LandingPage_changelog";
import Spin from "./components/loading/Spin";
import Home from "./pages/Home";
import ActivityFeed from "./pages/ActivityFeed";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Integrations from "./pages/Integrations";
import Automations from "./pages/Automations/Automations";
import OAuthSuccess from "./pages/OAuthSuccess";
import OAuthError from "./pages/OAuthError";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<Content />}>
            <Route index element={<Home />} />
            <Route path="activity" element={<ActivityFeed />} />
            <Route path="integrations" element={<Integrations />} />
            {import.meta.env.VITE_FEATURE_AUTOMATIONS === 'true' && (
              <Route path="automations" element={<Automations />} />
            )}
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
    <div className="h-full grid grid-cols-20">
      <div className="col-span-2 h-full bg-[theme(background-elevated)] flex-shrink-0 ">
        <Sidebar />
      </div>
      <div className="col-span-18 min-w-0 pl-8 overflow-y-auto pr-30">
        <Outlet />
      </div>
    </div>
  )
}

export default App