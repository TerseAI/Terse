import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

import { getExistingAuthenticatedUserName, loginAndWriteEnv } from "./auth.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"
import { resolveProvider } from "./providers/resolveProvider.js"
import { renderTemplate } from "./providers/templateUtils.js"

export async function init(projectName?: string, provider: LanguageProvider = resolveProvider({ command: "init", language: "ts" })): Promise<void> {
    const attachMode = !projectName && isAttachMode(provider, process.cwd())

    if (attachMode) {
        await initInAttachMode(provider)
        return
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

    const templateContext = provider.buildInitTemplateContext(resolvedName)

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

async function initInAttachMode(provider: LanguageProvider): Promise<void> {
    const cwd = process.cwd()
    const projectName = path.basename(cwd)
    const existingUserName = await getExistingAuthenticatedUserName(cwd)

    if (existingUserName) {
        console.log(`\n  ${chalk.green.bold("Already set up")} for ${chalk.bold(existingUserName)}.\n`)
        console.log(chalk.dim("  This project already has a valid TERSE_API_KEY, so init does not need to run again.\n"))
        console.log("  Next steps:\n")
        console.log(`  1. Run ${chalk.cyan("terse integrate")} to connect or review integrations`)
        console.log(`  2. Run ${chalk.cyan("terse generate")} to refresh generated helpers`)
        console.log(`  3. Run ${chalk.cyan("terse deploy")} when you're ready to sync jobs`)
        console.log("")
        return
    }

    console.log(`\n  Attaching Terse to existing project ${chalk.bold(projectName)}\n`)
    console.log(chalk.dim("  We detected an existing npm project, so init will avoid overwriting your package.json or scaffold files.\n"))
    console.log("  Choose how you want Terse to run:\n")
    console.log(`  ${chalk.bold("Self-hosted")}: your jobs run on your own infra via ${chalk.cyan("TERSE_JOB_URL")}; no source code is uploaded.\n`)
    console.log(`  ${chalk.bold("Serverless")}: Terse uploads a zip of the current project directory and stores it in GCS so jobs can run on Terse-managed infra.\n`)

    const mode = await select<"self-hosted" | "serverless">({
        message: "How do you want to run this existing project?",
        choices: [
            {
                value: "self-hosted",
                name: "Self-hosted",
                description: "Keep code on your infra and point Terse at TERSE_JOB_URL"
            },
            {
                value: "serverless",
                name: "Serverless",
                description: "Deploy by uploading a zip of this project directory to Terse"
            }
        ]
    })

    if (mode === "serverless") {
        const acknowledged = await confirm({
            message: "Serverless deploys will zip this project directory and store it in GCS. Continue with attach mode?",
            default: false
        })

        if (!acknowledged) {
            console.log(chalk.yellow("\n  Cancelled. No files were changed.\n"))
            process.exit(1)
        }
    }

    await loginAndWriteEnv(cwd)
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
    console.log(`  2. Add your Terse job definitions to ${chalk.cyan(provider.entryFile)} or your existing entrypoint`)
    if (mode === "self-hosted") {
        console.log(`  3. Set ${chalk.cyan("TERSE_JOB_URL")} in ${chalk.cyan(".env")} before running ${chalk.cyan("terse deploy")}`)
        console.log(`  4. Run ${chalk.cyan("terse integrate")} to connect integrations`)
    } else {
        console.log(`  3. Run ${chalk.cyan("terse integrate")} to connect integrations`)
        console.log(`  4. Run ${chalk.cyan("terse deploy")} when you're ready to upload this project`)
    }
    console.log("")
}

function isAttachMode(provider: LanguageProvider, cwd: string): boolean {
    return provider.language === "typescript" && fs.existsSync(path.join(cwd, "package.json"))
}

function canGenerateFromCurrentDirectory(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}
