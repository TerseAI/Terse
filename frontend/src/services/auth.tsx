import { createContext, useContext, useEffect, useState } from "react";
import { BackendProvider } from "./backend";
import { User } from "../types/User";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true);
      try {
        let me = await BackendProvider.getCurrentUser();
        setUser(me);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await BackendProvider.authenticateUser(email, password);
      let me = await BackendProvider.getCurrentUser();
      setUser(me);
    } catch (error) {
      throw new Error("Login failed");
    }
  };

  const logout = async () => {
    await BackendProvider.terminateSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;