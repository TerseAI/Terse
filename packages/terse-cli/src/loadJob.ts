import path from "node:path"
import { pathToFileURL } from "node:url"
import chalk from "chalk"
import { select } from "@inquirer/prompts"
import { tsImport } from "tsx/esm/api"
import { CreateJobParameters } from "terse-sdk"
import { assertProjectRoot } from "./assertProjectRoot.js"

/**
 * Imports the user's entry file and returns the full job registry.
 * Each createJob() call in src/index.ts populates this map.
 */
export async function loadJobRegistry(): Promise<Map<string, CreateJobParameters>> {
    assertProjectRoot()

    const cwd = process.cwd()
    const entryPath = path.join(cwd, "src", "index.ts")

    // Import the user's entry file via tsx — this triggers createJob() calls which
    // populate the global job registry on globalThis.__terse_jobRegistry.
    const parentURL = pathToFileURL(path.join(cwd, "package.json")).href
    try {
        await tsImport(entryPath, parentURL)
    } catch (err) {
        if (isModuleNotFoundError(err)) {
            const pkg = extractMissingPackage(err)
            console.error(chalk.red(`Error: Cannot find package '${pkg}' imported from src/index.ts`))
            if (pkg === "terse-sdk") {
                console.error(chalk.dim("\nMake sure terse-sdk is linked or installed in your project:"))
                console.error(chalk.dim("  pnpm link terse-sdk"))
                console.error(chalk.dim("  # or"))
                console.error(chalk.dim("  npm install terse-sdk"))
            } else {
                console.error(chalk.dim(`\nInstall the missing package: pnpm add ${pkg}`))
            }
        } else {
            console.error(chalk.red("Error importing src/index.ts:\n"))
            console.error(err)
        }
        process.exit(1)
    }

    // Read the registry from globalThis — populated by createJob() during the import above.
    // We use globalThis rather than importing the SDK again because tsx may load separate
    // module instances, which would give us an empty registry.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registry = (globalThis as any).__terse_jobRegistry as
        | Map<string, CreateJobParameters>
        | undefined

    if (!registry || registry.size === 0) {
        console.error(chalk.red("No jobs found. Make sure your src/index.ts calls client.createJob()."))
        process.exit(1)
    }

    return registry
}

export async function loadJob(jobName?: string): Promise<{ job: CreateJobParameters }> {
    const registry = await loadJobRegistry()

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
            choices: [...registry.keys()].map(name => ({ name, value: name })),
        })
    }

    return { job: registry.get(resolvedName)! }
}

function isModuleNotFoundError(err: unknown): err is Error & { code: string } {
    return err instanceof Error && (err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND"
}

function extractMissingPackage(err: Error): string {
    // Node's error message format: "Cannot find package 'foo' imported from ..."
    const match = err.message.match(/Cannot find package '([^']+)'/)
    return match?.[1] ?? "unknown"
}
