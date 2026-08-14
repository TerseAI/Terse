import { useEffect } from "react"

export default function OAuthSuccess() {
    useEffect(() => {
        // Notify parent window that OAuth was successful
        if (window.opener) {
            window.opener.postMessage({ type: "oauth-success" }, window.location.origin)
        }

        // Close the popup window after a short delay
        const timer = setTimeout(() => {
            window.close()
        }, 1000)

        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center justify-center gap-6 text-center px-6 max-w-2xl">
                <img src="/terse-160.png" alt="Terse" className="w-20 h-20 object-contain" />
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold leading-tight text-foreground">Integration connected</h1>
                    <p className="text-sm text-muted-foreground">You can close this window and return to Terse.</p>
                </div>
            </div>
        </div>
    )
}
