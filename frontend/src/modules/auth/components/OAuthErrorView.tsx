import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function OAuthError() {
    useEffect(() => {
        // Notify parent window that OAuth failed
        if (window.opener) {
            window.opener.postMessage({ type: "oauth-error" }, window.location.origin)
        }
    }, [])

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center justify-center gap-6 text-center px-6 max-w-2xl">
                <img src="/terse-160.png" alt="Terse" className="w-20 h-20 object-contain" />
                <h1 className="text-2xl font-semibold text-foreground leading-tight">There was an error connecting your integration. Please try again or contact support.</h1>
                <Button onClick={() => window.close()}>Close window</Button>
            </div>
        </div>
    )
}
