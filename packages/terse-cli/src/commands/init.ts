import { intro, log, outro } from "@clack/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"

import { CliError } from "../cliError.js"
import { type NonInteractiveOpts, isNonInteractive } from "../cliHelpers.js"
import { createSpinner } from "../cliUi.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { fetchSdkVersion } from "../providers/fetchSdkVersion.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { renderTemplate } from "../providers/templateUtils.js"

import { loginAndPersist } from "./auth.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"

export async function init(projectName?: string, provider: LanguageProvider = resolveProvider({ command: "init", language: "ts" }), opts?: NonInteractiveOpts): Promise<void> {
    const nonInteractive = isNonInteractive(opts)

    if (!projectName && fs.existsSync(path.join(process.cwd(), "package.json"))) {
        throw new CliError("init_in_existing_project", "Detected an existing npm project in this directory.", {
            detail: `terse init is for scaffolding new projects only. To add Terse to this project for self-hosted mode, run "terse attach" instead.`
        })
    }

    intro("terse init")

    const targetDir = projectName ? path.resolve(process.cwd(), projectName) : process.cwd()
    const resolvedName = projectName ?? path.basename(process.cwd())

    if (projectName) {
        if (fs.existsSync(targetDir)) {
            throw new CliError("directory_exists", `Directory "${projectName}" already exists.`)
        }
        fs.mkdirSync(targetDir, { recursive: true })
    }

    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true })

    const s = createSpinner()
    s.start(`Creating Terse project ${resolvedName}`)
    const sdkVersion = await fetchSdkVersion(provider.language)
    s.stop(`Created Terse project ${resolvedName}`)
    console.log(chalk.dim(`Using terse-sdk ${sdkVersion}`))

    const templateContext = provider.buildInitTemplateContext(resolvedName, sdkVersion)
    const scaffoldFiles = provider.scaffoldFiles()
    for (const file of scaffoldFiles) {
        const rendered = renderTemplate(file.template, templateContext)
        const outputPath = path.join(targetDir, file.output)
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, rendered)
    }
    console.log(chalk.dim("Scaffolded project files"))

    const pm = provider.detectPackageManager()
    s.start(`Installing dependencies with ${pm}`)

    await changeDirectory(targetDir)

    try {
        await provider.installDependencies(targetDir)
        s.stop(`Dependencies installed with ${pm}`)
    } catch {
        s.stop(`Failed to install dependencies. Run ${chalk.cyan(`${pm} install`)} manually.`)
    }

    const loginResult = await loginAndPersist(opts)
    const isAuthenticated = !!loginResult

    if (loginResult?.apiKey) {
        s.start("Creating Terse project")
        try {
            const config = await createRemoteProject(loginResult.apiKey, resolvedName)
            writeProjectConfig(targetDir, config)
            s.stop(`Created Terse project (${config.projectId})`)
        } catch (error) {
            s.stop(`Failed to create Terse project: ${(error as Error).message}`)
            log.warn(`You'll need to create a ${PROJECT_CONFIG_FILENAME} manually before running terse deploy.`)
        }
    }

    await listAndPromptIntegrations({ showLifecycle: false, nonInteractive })

    s.start("Generating code")
    try {
        await generate(provider, { showLifecycle: false })
        s.stop("Generated code")
    } catch {
        s.stop(`Failed to generate code. Run ${chalk.cyan("terse generate")} manually.`)
    }

    const nextSteps: string[] = []
    if (projectName) {
        nextSteps.push(`cd ${projectName}`)
    }
    if (!isAuthenticated) {
        nextSteps.push(`Run ${chalk.cyan("terse login")} to authenticate`)
    }
    nextSteps.push(`Edit ${chalk.cyan(provider.entryFile)} to define your job`)
    nextSteps.push(...provider.getPostInitSteps(pm))

    outro("Done")
    console.log("")
    console.log("Next steps:")
    nextSteps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`)
    })
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
