import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { getExistingAuthenticatedUserName, login } from "./auth.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"

export async function attach(provider: LanguageProvider = resolveProvider()): Promise<void> {
    const cwd = process.cwd()
    const projectName = path.basename(cwd)

    const existingUserName = await getExistingAuthenticatedUserName(cwd)

    if (existingUserName) {
        console.log(`\n  ${chalk.green.bold("Already set up")} for ${chalk.bold(existingUserName)}.\n`)
        console.log(chalk.dim("  This project already has a valid TERSE_API_KEY, so attach does not need to run again.\n"))
        console.log("  Next steps:\n")
        console.log(`  1. Run ${chalk.cyan("terse integrate")} to connect or review integrations`)
        console.log(`  2. Run ${chalk.cyan("terse generate")} to refresh generated helpers`)
        console.log(`  3. Run ${chalk.cyan("terse deploy")} when you're ready to sync jobs`)
        console.log("")
        return
    }

    console.log(`\n  Attaching Terse to existing project ${chalk.bold(projectName)}\n`)
    console.log(chalk.dim("  Your jobs will run on your own infrastructure via TERSE_REMOTE_SERVER_URL. No source code is uploaded to Terse.\n"))

    const result = await login()
    if (result?.apiKey) {
        console.log(`\n  Add this to your ${chalk.bold(".env")} file:\n`)
        console.log(`TERSE_API_KEY=${result.apiKey}`)
        console.log("")
    } else {
        console.log(chalk.dim("  You can run `terse login` later to authenticate."))
    }

    await listAndPromptIntegrations()

    if (canGenerateFromCurrentDirectory(provider, cwd)) {
        const spinner = ora("Generating code").start()
        try {
            await generate(provider)
            spinner.succeed("Generated code")
        } catch {
            spinner.warn(`Failed to generate code. Run ${chalk.cyan("terse generate")} manually.`)
        }
    } else {
        console.log(chalk.yellow(`\n  Skipped code generation because this repo is missing ${provider.detectionMarkers.requiredFiles.join(", ")}.`))
        console.log(chalk.dim(`  Add your job entrypoint at ${provider.entryFile}, then run ${chalk.cyan("terse generate")} manually.\n`))
    }

    console.log(`\n  ${chalk.green.bold("Done!")} Terse is attached to your existing project.\n`)
    console.log("  Next steps:\n")
    console.log(`  1. Install ${chalk.cyan("terse-sdk")} in this repo if you haven't already`)
    console.log(`  2. Add your Terse job definitions to ${chalk.cyan(provider.entryFile)} and import that file from your app startup path`)
    console.log(chalk.dim(`     If your self-hosted app keeps jobs in another file, use ${chalk.cyan("--entry-file")} with terse test, terse run, and terse deploy.`))
    console.log(`  3. Set ${chalk.cyan("TERSE_REMOTE_SERVER_URL")} in ${chalk.cyan(".env")} before running ${chalk.cyan("terse deploy")}`)
    console.log(`  4. Run ${chalk.cyan("terse integrate")} to connect integrations`)
    console.log("")
}

function canGenerateFromCurrentDirectory(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}
