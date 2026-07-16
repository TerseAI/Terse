import { useEffect } from "react"

import { toast } from "sonner"
import { type KeyedMutator } from "swr"

/**
 * Hook to listen for OAuth success messages and trigger a refetch
 * @param mutate - The SWR mutate function to call when OAuth succeeds
 */
export function useOAuthSuccessListener<T = any>(mutate: KeyedMutator<T>, successCallback?: () => void) {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return
            if (event.data?.type === "oauth-success") {
                mutate()
                successCallback?.()
            }
            if (event.data?.type === "oauth-error") {
                // Fixed id dedupes the toast when several integration hooks are mounted
                toast.error("Failed to connect integration. Please try again.", { id: "oauth-error", duration: Infinity, closeButton: true })
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [mutate])
}
