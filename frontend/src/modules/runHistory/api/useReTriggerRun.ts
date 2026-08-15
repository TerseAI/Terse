import { useState } from "react"

import { toast } from "sonner"

import { BackendProvider } from "@/lib/http"

export function useReTriggerRun({ agentId, runId }: { agentId: string; runId: string }) {
    const [isReTriggering, setIsReTriggering] = useState(false)

    const reTriggerRun = async () => {
        if (isReTriggering) return
        setIsReTriggering(true)
        try {
            await BackendProvider.triggerWithEvent(agentId, undefined, runId)
            toast.success("Run re-triggered")
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status
            if (status === 404) {
                toast.error("Could not re-trigger run: the original event or automation is no longer available")
            } else {
                toast.error("Failed to re-trigger run")
            }
        } finally {
            setIsReTriggering(false)
        }
    }

    return { reTriggerRun, isReTriggering }
}
