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
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold leading-tight text-foreground">Couldn’t connect the integration</h1>
                    <p className="text-sm text-muted-foreground">Try connecting again. If the problem continues, contact support.</p>
                </div>
                <Button onClick={() => window.close()}>Close Window</Button>
            </div>
        </div>
    )
}
