import { select } from "@inquirer/prompts"
import chalk from "chalk"
import { CreateJobParameters } from "terse-sdk"

import { assertProjectRoot } from "./assertProjectRoot.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Imports the user's entry file and returns the full job registry.
 * Each createJob() call populates this map.
 */
export async function loadJobRegistry(provider: LanguageProvider): Promise<Map<string, CreateJobParameters>> {
    assertProjectRoot(provider, provider.detectionMarkers)
    return provider.loadJobRegistry()
}

export async function loadJob(provider: LanguageProvider, jobName?: string): Promise<{ job: CreateJobParameters }> {
    const registry = await loadJobRegistry(provider)

    if (registry.size === 0) {
        console.error(chalk.red("No jobs found."))
        console.log(`\nMake sure ${provider.entryFile} registers at least one job.`)
        console.log(`Check that your ${provider.detectionMarkers.requiredFiles.join(" and ")} are configured correctly.`)
        process.exit(1)
    }

    // Resolve which job to run
    let resolvedName: string

    if (jobName) {
        if (!registry.has(jobName)) {
            console.error(chalk.red(`Job "${jobName}" not found.`))
            console.log("\nAvailable jobs:")
            for (const name of registry.keys()) {
                console.log(`  - ${name}`)
            }
            process.exit(1)
        }
        resolvedName = jobName
    } else if (registry.size === 1) {
        resolvedName = registry.keys().next().value!
    } else {
        resolvedName = await select<string>({
            message: "Multiple jobs found. Which one?",
            choices: [...registry.keys()].map(name => ({ name, value: name }))
        })
    }

    return { job: registry.get(resolvedName)! }
}
