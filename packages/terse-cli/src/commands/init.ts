import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { fetchSdkVersion } from "../providers/fetchSdkVersion.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { renderTemplate } from "../providers/templateUtils.js"

import { loginAndWriteEnv } from "./auth.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"

export async function init(projectName?: string, provider: LanguageProvider = resolveProvider({ command: "init", language: "ts" })): Promise<void> {
    if (!projectName && fs.existsSync(path.join(process.cwd(), "package.json"))) {
        console.error(chalk.red("\n  Error: Detected an existing npm project in this directory."))
        console.error(chalk.dim("  terse init is for scaffolding new projects only.\n"))
        console.error(`  To add Terse to this project for self-hosted mode, run ${chalk.cyan("terse attach")} instead.\n`)
        process.exit(1)
    }

    const targetDir = projectName ? path.resolve(process.cwd(), projectName) : process.cwd()
    const resolvedName = projectName ?? path.basename(process.cwd())

    console.log(`\n  Creating Terse project ${chalk.bold(resolvedName)}\n`)

    // Create target directory if it doesn't exist
    if (projectName) {
        if (fs.existsSync(targetDir)) {
            console.error(chalk.red(`Error: Directory "${projectName}" already exists.`))
            process.exit(1)
        }
        fs.mkdirSync(targetDir, { recursive: true })
    }

    // Create the source directory up front. Nested template paths create their own parents.
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true })

    const versionSpinner = ora("Fetching latest SDK version").start()
    const sdkVersion = await fetchSdkVersion(provider.language)
    versionSpinner.succeed(`Using terse-sdk ${sdkVersion}`)

    const templateContext = provider.buildInitTemplateContext(resolvedName, sdkVersion)

    // Write files from templates
    for (const file of provider.scaffoldFiles()) {
        const rendered = renderTemplate(file.template, templateContext)
        const outputPath = path.join(targetDir, file.output)
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, rendered)
        console.log(`  ${chalk.green("+")} ${file.output}`)
    }

    // Install dependencies
    const pm = provider.detectPackageManager()
    const spinner = ora(`Installing dependencies with ${pm}`).start()

    // Rest of commands run in newly generated project directory
    await changeDirectory(targetDir)

    try {
        await provider.installDependencies(targetDir)
        spinner.succeed(`Dependencies installed with ${pm}`)
    } catch {
        spinner.warn(`Failed to install dependencies. Run ${chalk.cyan(`${pm} install`)} manually.`)
    }

    // Authenticate via browser and write API key to .env
    await loginAndWriteEnv(targetDir)

    const envExists = fs.existsSync(path.join(targetDir, ".env"))

    // Connect integrations
    await listAndPromptIntegrations()

    try {
        await generate(provider)
        spinner.succeed(`Generated code`)
    } catch {
        spinner.warn(`Failed to generate code. Run ${chalk.cyan(`$terse generate`)} manually.`)
    }

    console.log(`\n  ${chalk.green.bold("Done!")} Your Terse project is ready.\n`)
    console.log("  Next steps:\n")

    let step = 1
    if (projectName) {
        console.log(`  ${step}. cd ${projectName}`)
        step++
    }
    if (!envExists) {
        console.log(`  ${step}. Run ${chalk.cyan("terse login")} to authenticate`)
        step++
    }
    console.log(`  ${step}. Edit ${provider.entryFile} to define your job`)
    step++
    const postInitSteps = provider.getPostInitSteps(pm)
    for (const postInitStep of postInitSteps) {
        console.log(`  ${step}. ${postInitStep}`)
        step++
    }
    console.log("")
}

function changeDirectory(targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            process.chdir(targetDir)
            resolve()
        } catch (err) {
            reject(err)
        }
    })
}
