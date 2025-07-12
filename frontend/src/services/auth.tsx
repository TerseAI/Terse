import { createContext, useContext, useEffect, useState } from "react";
import { BackendProvider } from "./backend";
import { User } from "../types/User";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  loginWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  initSession: (token: string) => Promise<void>;
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

  const initSession = async (token: string) => {
    await BackendProvider.setSession(token);
    let me = await BackendProvider.getCurrentUser();
    setUser(me);
  }

  const logout = async () => {
    await BackendProvider.terminateSession();
    setUser(null);
  };

  const loginWithGithub = async () => {
    const { url } = await BackendProvider.getGithubLogInURL();
    setIsLoading(true);
    const popup = window.open(
      url, 
      'github-login',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsLoading(false);
      return;
    }
  
    // Or listen for postMessage from popup
    window.addEventListener('message', (event) => {
      if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
        console.log('GITHUB_AUTH_SUCCESS event', event)
        console.log('GITHUB_AUTH_SUCCESS', event.data.token)
        initSession(event.data.token);
        setIsLoading(false);
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGithub, logout, isLoading, initSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;