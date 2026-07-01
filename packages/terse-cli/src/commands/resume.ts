import { CliError } from "../cliError.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function resume(runId?: string, opts?: { verbose?: boolean }, provider: LanguageProvider = resolveProvider()): Promise<void> {
    if (!runId) {
        throw new CliError("missing_run_id", "Provide --run-id <id>.", {
            detail: "Usage: terse resume --run-id wrun_..."
        })
    }
    await provider.resumeRun(runId, { verbose: opts?.verbose })
}
