import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./services/auth";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { IntegrationProvider } from "./context/Integrations";
import LandingPage from "./pages/LandingPage";
import LandingPageChangelog from "./pages/LandingPage_changelog";
import Spin from "./components/loading/Spin";
import Home from "./pages/Home";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/app" element={<Content />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/changelog" element={<LandingPageChangelog />} />
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
              <Home />
            </div>
          ) : (
            <div key="login">
              <h1>Login</h1>
            </div>
          )}
        </AnimatePresence>
      </IntegrationProvider>
    </>
  );
}

export default App