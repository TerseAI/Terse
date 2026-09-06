export function filterDurableObjectTelemetry(output: string, log: (event: Record<string, unknown>) => void): string {
    return output
        .split(/(?<=\n)/)
        .filter(line => {
            let event: Record<string, unknown> | null
            try {
                event = JSON.parse(line)
            } catch {
                return true
            }
            if (event?.event !== "actor_client_invocation" || typeof event.request_id !== "string" || typeof event.namespace_id !== "string") return true
            log(event)
            return false
        })
        .join("")
}
