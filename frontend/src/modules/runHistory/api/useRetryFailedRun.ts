import { useState } from "react"

import { toast } from "sonner"

import { BackendProvider } from "@/lib/http"

export function useRetryFailedRun(runId: string) {
    const [isRetrying, setIsRetrying] = useState(false)

    const retryFailedRun = async () => {
        if (isRetrying) return
        setIsRetrying(true)
        try {
            await BackendProvider.retryFailedRun(runId)
            toast.success("Retry started from the last durable checkpoint")
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status
            if (status === 404) {
                toast.error("This run is no longer available")
            } else if (status === 409) {
                toast.error("This run can no longer be retried from its failure snapshot")
            } else {
                toast.error("Failed to retry run")
            }
        } finally {
            setIsRetrying(false)
        }
    }

    return { retryFailedRun, isRetrying }
}
