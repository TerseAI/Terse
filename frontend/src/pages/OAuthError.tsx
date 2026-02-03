import { useEffect } from "react"

export default function OAuthError() {
    useEffect(() => {
        // Close the popup window after 3 seconds to give user time to read
        const timer = setTimeout(() => {
            window.close()
        }, 3000)

        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center justify-center gap-6 text-center px-6 max-w-2xl">
                <img src="/terse.png" alt="Terse" className="w-20 h-20 object-contain" />
                <h1 className="text-2xl font-semibold text-foreground leading-tight">There was an error connecting your integration. Please try again or contact support.</h1>
            </div>
        </div>
    )
}
