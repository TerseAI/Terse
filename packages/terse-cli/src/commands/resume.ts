import { CliError } from "../cliError.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function resume(runId?: string, opts?: { verbose?: boolean }, provider: LanguageProvider = resolveProvider()): Promise<void> {
    if (!runId) {
        throw new CliError("missing_run_id", "Provide --run-id <id>.", {
            detail: "Usage: terse resume --run-id wrun_..."
        })
    }

    // The backend sets these when the resume delivers a human response (waitForInput);
    // a plain timer/recovery resume runs without them.
    const hookToken = process.env.TERSE_RESUME_HOOK_TOKEN
    if (!hookToken) {
        await provider.resumeRun(runId, { verbose: opts?.verbose })
        return
    }

    const payloadRaw = process.env.TERSE_RESUME_HOOK_PAYLOAD
    if (!payloadRaw) {
        throw new CliError("missing_hook_payload", "TERSE_RESUME_HOOK_TOKEN is set but TERSE_RESUME_HOOK_PAYLOAD is missing.")
    }
    let payload: unknown
    try {
        payload = JSON.parse(payloadRaw)
    } catch {
        throw new CliError("invalid_hook_payload", "TERSE_RESUME_HOOK_PAYLOAD is not valid JSON.")
    }

    await provider.resumeRunWithInput(runId, { token: hookToken, payload }, { verbose: opts?.verbose })
}
