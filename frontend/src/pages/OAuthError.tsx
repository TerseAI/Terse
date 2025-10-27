import { useEffect } from 'react';

export default function OAuthError() {
    useEffect(() => {
        // Close the popup window after 3 seconds to give user time to read
        const timer = setTimeout(() => {
            window.close();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-9xl font-bold text-white mb-4">ERROR</h1>
                <p className="text-lg text-gray-400">This window will close automatically...</p>
            </div>
        </div>
    );
}
