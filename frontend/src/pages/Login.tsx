import { useEffect, useState } from 'react';
import AnimateableBlock from '../components/AnimateableBlock';
import { BackendProvider } from '../services/backend';
import { useAuth } from '../services/auth';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [githubLoginUrl, setGithubLoginUrl] = useState('');
  const { initSession } = useAuth();

  useEffect(() => {
    const getGithubLoginUrl = async () => {
      const { url } = await BackendProvider.getGithubLogInURL();
      setGithubLoginUrl(url);
      console.log('githubLoginUrl', githubLoginUrl)
    }
    getGithubLoginUrl();
  }, []);

  const handleGithubLogin = () => {
    setIsLoading(true);
    const popup = window.open(
      githubLoginUrl, 
      'github-login',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) return;
  
    // Listen for popup to close or send message
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // Popup closed, check if user is now authenticated
        checkAuthStatus();
      }
    }, 1000);
  
    // Or listen for postMessage from popup
    window.addEventListener('message', (event) => {
      if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
        console.log('GITHUB_AUTH_SUCCESS event', event)
        console.log('GITHUB_AUTH_SUCCESS', event.data.token)
        initSession(event.data.token);
      }
    });
  };
  
  const checkAuthStatus = async () => {
    try {
      const user = await BackendProvider.getCurrentUser();
      setIsLoading(false);
      console.log('user', user)
    } catch (error) {
      console.error('error', error)
      setIsLoading(false);
    }
  };

  return (
    <div className="grid place-items-center pt-16 w-full">
      <div className="flex flex-col items-center">
        <AnimateableBlock delay={0}>
          <div className="mb-24">
            <h1 className="text-7xl font-sans text-gray-900 drop-shadow-sm">Welcome to the <span className="text-purple-500">Vectra</span> Closed Alpha.</h1>
          </div>
        </AnimateableBlock>

        <AnimateableBlock delay={200}>
          <div
            className={`
          bg-[rgb(8,9,10, 0.5)]
          backdrop-blur-md 
          text-white 
          p-8 
          rounded-xl 
          shadow-xl 
          border border-gray-800
          w-full max-w-xl
        `}
          >
            <h1 className="text-2xl text-gray-900 font-sans mb-6 relative text-center">Sign in with your GitHub account to continue.</h1>

            <button
              onClick={handleGithubLogin}
              disabled={isLoading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:ring-offset-2 focus:ring-offset-black relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 hover:border-gray-600"
            >
              <span className="flex items-center justify-center font-sans relative z-10 text-lg">
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="mr-3 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                )}
                {isLoading ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
              </span>
            </button>

            <div className="mt-6 text-center text-gray-400 text-sm">
              <p>You'll be redirected to GitHub to authorize this application.</p>
            </div>
          </div>
        </AnimateableBlock>
      </div>
    </div>
  );
}
