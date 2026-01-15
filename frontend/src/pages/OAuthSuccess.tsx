import { useEffect } from 'react';

export default function OAuthSuccess() {
    useEffect(() => {
        // Notify parent window that OAuth was successful
        if (window.opener) {
            window.opener.postMessage({ type: 'oauth-success' }, '*');
        }

        // Close the popup window after a short delay
        const timer = setTimeout(() => {
            window.close();
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center justify-center gap-6 text-center px-6 max-w-2xl">
                <img src="/terse.png" alt="Terse" className="w-20 h-20 object-contain" />
                <h1 className="text-2xl font-semibold text-foreground leading-tight">
                    Your integration with Terse was successfully completed, you can close this window now.
                </h1>
            </div>
        </div>
    );
}
