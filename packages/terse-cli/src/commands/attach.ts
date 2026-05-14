import { intro, log, outro } from "@clack/prompts"
import { select } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import type { SdkOrganizationsListResponse } from "terse-types"

import { fetchWithAuth } from "../api.js"
import { type NonInteractiveOpts, isNonInteractive } from "../cliHelpers.js"
import { createSpinner, logNextSteps } from "../cliUi.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, readProjectConfig, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

import { getProjectAttachedUserName, loginAndPersist } from "./auth.js"
import { resolveApiKeyForOrg } from "./authOrg.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"

export async function attach(provider: LanguageProvider = resolveProvider(), opts?: NonInteractiveOpts): Promise<void> {
    const nonInteractive = isNonInteractive(opts)
    intro("terse attach")

    const cwd = process.cwd()
    const projectName = path.basename(cwd)

    const existingUserName = await getProjectAttachedUserName(cwd)

    if (existingUserName) {
        log.step(`Already set up for ${chalk.bold(existingUserName)}`)
        log.info("This project already has a valid TERSE_API_KEY, so attach does not need to run again.")
        logNextSteps([
            `Run ${chalk.cyan("terse integrate")} to connect or review integrations`,
            `Run ${chalk.cyan("terse generate")} to refresh generated helpers`,
            `Run ${chalk.cyan("terse deploy")} when you're ready to sync jobs`
        ])
        outro("Done")
        return
    }

    log.info(`Attaching Terse to existing project ${chalk.bold(projectName)}`)
    log.info("Self-hosted mode keeps your jobs on your own infrastructure via TERSE_REMOTE_SERVER_URL. No source code is uploaded to Terse.")

    const result = await loginAndPersist(opts)
    let attachApiKey: string | null = result?.apiKey ?? null

    if (result?.apiKey) {
        attachApiKey = await pickOrgForAttach(result.apiKey, nonInteractive)
        log.info(`Add ${chalk.cyan("TERSE_API_KEY")} to your server environment so your app can authenticate at runtime.`)
        log.step(`TERSE_API_KEY=${attachApiKey}`)
    } else {
        log.info("You can run `terse auth login` later to authenticate.")
    }

    if (attachApiKey && !readProjectConfig(cwd)) {
        const s = createSpinner()
        s.start("Creating Terse project")
        try {
            const config = await createRemoteProject(attachApiKey, projectName)
            const selfHostedConfig = { ...config, selfHosted: true, remoteServerUrl: "" }
            writeProjectConfig(cwd, selfHostedConfig)
            s.stop(`Created Terse project (${config.projectId})`)
            log.step(`Created ${PROJECT_CONFIG_FILENAME}`)
            log.info(`Self-hosted mode enabled. Set ${chalk.cyan("remoteServerUrl")} in ${PROJECT_CONFIG_FILENAME} before running ${chalk.cyan("terse deploy")}.`)
        } catch (error) {
            s.stop(`Failed to create Terse project: ${(error as Error).message}`)
            log.warn(`You'll need to create a ${PROJECT_CONFIG_FILENAME} manually before running ${chalk.cyan("terse deploy")}.`)
        }
    }

    log.info("Reviewing integrations")
    await listAndPromptIntegrations({ showLifecycle: false, nonInteractive })

    if (canGenerateFromCurrentDirectory(provider, cwd)) {
        const s = createSpinner()
        s.start("Generating code")
        try {
            await generate(provider)
            s.stop("Generated code")
        } catch {
            s.stop(`Failed to generate code. Run ${chalk.cyan("terse generate")} manually.`)
        }
    } else {
        log.warn(`Skipped code generation because this repo is missing ${provider.detectionMarkers.requiredFiles.join(", ")}.`)
        log.info(`Add your job entrypoint at ${chalk.cyan(provider.entryFile)}, then run ${chalk.cyan("terse generate")} manually.`)
    }

    log.info("Next steps")
    logNextSteps([
        `Install ${chalk.cyan("terse-sdk")} in this repo if you haven't already`,
        `Add your Terse job definitions to ${chalk.cyan(provider.entryFile)} and import that file from your app startup path`,
        `Set ${chalk.cyan("remoteServerUrl")} in ${chalk.cyan(PROJECT_CONFIG_FILENAME)} before running ${chalk.cyan("terse deploy")}`,
        `Run ${chalk.cyan("terse integrate")} to connect integrations`
    ])
    log.info(chalk.dim(`If your self-hosted app keeps jobs in another file, use ${chalk.cyan("--entry-file")} with terse test and terse deploy.`))

    outro("Done")
}

async function pickOrgForAttach(currentApiKey: string, nonInteractive: boolean): Promise<string> {
    const orgsData = await fetchWithAuth<SdkOrganizationsListResponse>("/sdk/me/organizations", currentApiKey)
    if (orgsData.organizations.length <= 1 || nonInteractive) return currentApiKey

    const activeId = orgsData.activeOrganizationId
    const chosenId = await select({
        message: "Attach this project to which organization?",
        choices: orgsData.organizations.map(o => ({
            name: o.id === activeId ? `${o.name} ${chalk.dim("(active)")}` : o.name,
            value: o.id
        })),
        default: activeId
    })

    if (chosenId === activeId) return currentApiKey

    const chosen = orgsData.organizations.find(o => o.id === chosenId)!
    return resolveApiKeyForOrg(chosen.id, chosen.name, currentApiKey)
}

function canGenerateFromCurrentDirectory(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}
