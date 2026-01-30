/* eslint-disable react-refresh/only-export-components */
import { AxiosError } from "axios";
import { posthog } from "posthog-js";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "../types/User";
import { BackendProvider } from "./backend";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function identifyInPostHog(user: User) {
  posthog.identify(user.id, {
    email: user.email,
    display_name: user.display_name
  });
  posthog.setPersonPropertiesForFlags({ email: user.email });
}

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const currentUser = await BackendProvider.getCurrentUser();
    identifyInPostHog(currentUser);
    return currentUser;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 401) {
      BackendProvider.loginRedirect();
      return null;
    }
    console.error("Error fetching user:", error);
    return null;
  }
}

async function runRefresh(
  setUser: (u: User | null) => void,
  setIsLoading: (loading: boolean) => void
): Promise<void> {
  setIsLoading(true);
  try {
    const user = await fetchCurrentUser();
    setUser(user);
  } finally {
    setIsLoading(false);
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    runRefresh(setUser, setIsLoading);
  }, []);

  function logout() {
    BackendProvider.logoutRedirect();
  }

  function refreshUser() {
    return runRefresh(setUser, setIsLoading);
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