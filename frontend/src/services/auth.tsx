import { createContext, useContext, useEffect, useState } from "react";
import { BackendProvider } from "./backend";
import { User } from "../types/User";
import { posthog } from "posthog-js";
import { PosthogEvents } from "../utility/PosthogEvents";

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  loginWithGithub: () => void;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  initSession: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [githubLoginUrl, setGithubLoginUrl] = useState('');
  const [googleLoginUrl, setGoogleLoginUrl] = useState('');

  useEffect(() => {
    const getGithubLoginUrl = async () => {
      const { url } = await BackendProvider.getGithubLogInURL();
      setGithubLoginUrl(url);
    }
    getGithubLoginUrl();

    const getGoogleLoginUrl = async () => {
      const { url } = await BackendProvider.getGoogleLogInURL();
      setGoogleLoginUrl(url);
    }
    getGoogleLoginUrl();

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
      posthog.capture(PosthogEvents.USER_SIGNED_IN, {
        email: me.email,
      });
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
    posthog.capture(PosthogEvents.USER_SIGNED_OUT, {
      email: user?.email || 'unknown',
    });
    await BackendProvider.terminateSession();
    setUser(null);
  };

  const loginWithGithub = () => {
    setIsLoading(true);
    const popup = window.open(
      githubLoginUrl,
      'github-login',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsLoading(false);
      return;
    }

    // Or listen for postMessage from popup
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
        console.log('GITHUB_AUTH_SUCCESS event', event)
        console.log('GITHUB_AUTH_SUCCESS', event.data.token)
        await initSession(event.data.token);
        // Store last used auth provider after successful login
        localStorage.setItem('lastAuthProvider', 'github');
        posthog.capture(PosthogEvents.USER_INTEGRATED_GITHUB, {
          email: user?.email || 'unknown',
        });
        setIsLoading(false);
        window.location.href = '/app';
      }
    });
  };

  const loginWithGoogle = () => {
    setIsLoading(true);
    const popup = window.open(
      googleLoginUrl,
      'google-login',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsLoading(false);
      return;
    }

    // Listen for postMessage from popup
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log('GOOGLE_AUTH_SUCCESS event', event)
        console.log('GOOGLE_AUTH_SUCCESS', event.data.token)
        await initSession(event.data.token);
        // Store last used auth provider after successful login
        localStorage.setItem('lastAuthProvider', 'google');
        posthog.capture(PosthogEvents.USER_SIGNED_IN, {
          email: user?.email || 'unknown',
        });
        setIsLoading(false);
        window.location.href = '/app';
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGithub, loginWithGoogle, logout, isLoading, initSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;