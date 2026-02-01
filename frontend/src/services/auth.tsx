/* eslint-disable react-refresh/only-export-components */
import { AxiosError } from "axios";
import { posthog } from "posthog-js";
import { createContext, useContext, useEffect } from "react";
import type { User } from "../types/User";
import { useCurrentUser } from "../hooks/api/useCurrentUser";
import { BackendProvider } from "./backend";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, error, mutate } = useCurrentUser();

  // Handle 401 redirect
  useEffect(() => {
    if (error instanceof AxiosError && error.response?.status === 401) {
      BackendProvider.loginRedirect();
    }
  }, [error]);

  // PostHog identification
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        displayName: user.displayName,
      });
      posthog.setPersonPropertiesForFlags({ email: user.email });
    }
  }, [user]);

  function logout() {
    BackendProvider.logoutRedirect();
  }

  async function refreshUser() {
    await mutate();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
