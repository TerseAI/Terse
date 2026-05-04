import type { SdkJobServerCheckStep } from "terse-types"

/**
 * Human-readable label for each verification handshake stage. Shared by the manual
 * "Verify Server" dialog and the run-history `webhook_failure` snippet so failure
 * messaging stays consistent across surfaces.
 */
export function formatServerCheckStep(step: SdkJobServerCheckStep): string {
    switch (step) {
        case "http":
            return "Connecting to the trigger endpoint"
        case "json":
            return "Reading the server response"
        case "response_schema":
            return "Validating the handshake payload"
        case "challenge_echo":
            return "Verifying the challenge response"
        case "challenge_signature":
            return "Verifying the signing secret"
        default:
            return step
    }
}
