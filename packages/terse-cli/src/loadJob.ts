import { select } from "@inquirer/prompts"
import { CreateJobParameters } from "terse-sdk"

import { assertProjectRoot } from "./assertProjectRoot.js"
import { CliError } from "./cliError.js"
import { type NonInteractiveOpts, isNonInteractive } from "./nonInteractive.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Imports the user's entry file and returns the full job registry.
 * Each createJob() call populates this map.
 */
export async function loadJobRegistry(provider: LanguageProvider, entryFile?: string): Promise<Map<string, CreateJobParameters>> {
    assertProjectRoot(provider, provider.detectionMarkers)
    return provider.loadJobRegistry(entryFile)
}

export async function loadJob(provider: LanguageProvider, jobName?: string, entryFile?: string, opts?: NonInteractiveOpts): Promise<{ job: CreateJobParameters }> {
    const registry = await loadJobRegistry(provider, entryFile)

    if (registry.size === 0) {
        throw new CliError("no_jobs_found", "No jobs found.", {
            detail: `Make sure ${provider.entryFile} registers at least one job.`
        })
    }

    let resolvedName: string

    if (jobName) {
        if (!registry.has(jobName)) {
            const available = [...registry.keys()].join(", ")
            throw new CliError("job_not_found", `Job "${jobName}" not found.`, {
                detail: `Available jobs: ${available}`
            })
        }
        resolvedName = jobName
    } else if (registry.size === 1) {
        resolvedName = registry.keys().next().value!
    } else if (isNonInteractive(opts)) {
        const available = [...registry.keys()].join(", ")
        throw new CliError("job_selection_required", "Multiple jobs found — specify which one to use.", {
            detail: `Available jobs: ${available}. Pass the job name as an argument.`
        })
    } else {
        resolvedName = await select<string>({
            message: "Multiple jobs found. Which one?",
            choices: [...registry.keys()].map(name => ({ name, value: name }))
        })
    }

    return { job: registry.get(resolvedName)! }
}
