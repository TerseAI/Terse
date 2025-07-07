import { AnimatePresence } from "framer-motion";
import Login from "./pages/Login";
import { AuthProvider, useAuth } from "./services/auth";
import Spin from "./components/Spin";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./pages/Home";
import { IntegrationProvider } from "./context/Integrations";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Content />} />
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
          <div key="main">
            <Home />
          </div>
        ) : (
          <Login key="login" />
        )}
      </AnimatePresence>
      </IntegrationProvider>
    </>
  );
}

export default App