import { intro, log, outro } from "@clack/prompts"
import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import type { ProjectEnableSelfHostedResponse, SdkOrganizationsListResponse, TerseProjectConfig } from "terse-types"

import { fetchWithAuth } from "../api.js"
import { CliError, ErrorCode } from "../cliError.js"
import { type NonInteractiveOpts, isNonInteractive } from "../cliHelpers.js"
import { createSpinner, logNextSteps, printSelfHostedCredentials } from "../cliUi.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, enableRemoteSelfHosted, fetchRemoteProjectDetail, readProjectConfig, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

import { getProjectAttachedUserName, loginAndPersist } from "./auth.js"
import { resolveApiKeyForOrg } from "./authOrg.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"

export async function attach(provider: LanguageProvider = resolveProvider(), opts?: AttachOpts): Promise<void> {
    const nonInteractive = isNonInteractive(opts)
    intro("terse attach")

    const cwd = process.cwd()
    const projectName = path.basename(cwd)

    const existingUserName = await getProjectAttachedUserName(cwd)

    if (existingUserName && !opts?.regenerateCredentials) {
        log.step(`Already set up for ${chalk.bold(existingUserName)}`)
        log.info("This project already has valid CLI credentials, so attach does not need to run again.")
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
    let signingSecret: string | undefined
    let projectApiKey: string | undefined

    if (result?.apiKey) {
        attachApiKey = await pickOrgForAttach(result.apiKey, nonInteractive)
    } else {
        log.info("You can run `terse auth login` later to authenticate.")
    }

    const existingConfig = readProjectConfig(cwd)

    if (attachApiKey && !existingConfig) {
        const s = createSpinner()
        s.start("Creating Terse project")
        try {
            const created = await createRemoteProject(attachApiKey, projectName, true)
            signingSecret = created.signingSecret
            projectApiKey = created.projectApiKey
            const selfHostedConfig = { ...created.config, selfHosted: true, remoteServerUrl: "" }
            writeProjectConfig(cwd, selfHostedConfig)
            s.stop(`Created Terse project (${created.config.projectId})`)
            log.step(`Created ${PROJECT_CONFIG_FILENAME}`)
            log.info(`Self-hosted mode enabled. Set ${chalk.cyan("remoteServerUrl")} in ${PROJECT_CONFIG_FILENAME} before running ${chalk.cyan("terse deploy")}.`)
        } catch (error) {
            s.stop(`Failed to create Terse project: ${(error as Error).message}`)
            log.warn(`You'll need to create a ${PROJECT_CONFIG_FILENAME} manually before running ${chalk.cyan("terse deploy")}.`)
        }
    }

    if (attachApiKey && existingConfig) {
        const credentials = await provisionSelfHostedCredentials(attachApiKey, existingConfig.projectId, {
            requested: opts?.regenerateCredentials,
            nonInteractive
        })
        enableSelfHostedMode(cwd, existingConfig)
        signingSecret = credentials?.signingSecret
        projectApiKey = credentials?.projectApiKey
    }

    printSelfHostedCredentials({ apiKey: projectApiKey, apiKeyVar: "TERSE_PROJECT_KEY", apiKeyLabel: "project API key", signingSecret })

    log.info("Reviewing integrations")
    await listAndPromptIntegrations({
        showLifecycle: false,
        nonInteractive,
        ...(attachApiKey ? { apiKey: attachApiKey } : {})
    })

    if (canGenerateFromCurrentDirectory(provider, cwd)) {
        const s = createSpinner()
        s.start("Generating code")
        try {
            await generate(provider, attachApiKey ? { apiKey: attachApiKey } : undefined)
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

function enableSelfHostedMode(cwd: string, config: TerseProjectConfig): void {
    if (config.selfHosted) return

    writeProjectConfig(cwd, { ...config, selfHosted: true, remoteServerUrl: config.remoteServerUrl ?? "" })
    log.step(`Enabled self-hosted mode in ${PROJECT_CONFIG_FILENAME}`)
    log.info(`This project now runs on your own data plane. Set ${chalk.cyan("remoteServerUrl")} in ${PROJECT_CONFIG_FILENAME} before running ${chalk.cyan("terse deploy")}.`)
}

/**
 * The two credentials are only ever issued as a pair, so a project missing either one gets both
 * replaced. Anything the project already holds stops working the moment this runs, which is why an
 * already-provisioned project needs explicit consent.
 */
async function provisionSelfHostedCredentials(apiKey: string, projectId: string, params: { requested?: boolean; nonInteractive: boolean }): Promise<ProjectEnableSelfHostedResponse | null> {
    const detail = await fetchProjectDetail(apiKey, projectId)
    const holdsCredentials = detail.hasSigningSecret || detail.hasProjectApiKey

    if (holdsCredentials && !params.requested && !(await confirmReplacement(params.nonInteractive))) return null

    const s = createSpinner()
    s.start(holdsCredentials ? "Replacing data plane credentials" : "Generating data plane credentials")
    try {
        const credentials = await enableRemoteSelfHosted(apiKey, projectId)
        s.stop(holdsCredentials ? "Replaced the data plane credentials" : "Generated the data plane credentials")
        return credentials
    } catch (error) {
        s.stop("Could not generate the data plane credentials")
        throw toCredentialsError(error)
    }
}

async function fetchProjectDetail(apiKey: string, projectId: string) {
    const s = createSpinner()
    s.start("Checking data plane credentials")
    try {
        const detail = await fetchRemoteProjectDetail(apiKey, projectId)
        s.stop("Checked data plane credentials")
        return detail
    } catch (error) {
        s.stop("Could not check data plane credentials")
        throw toCredentialsError(error)
    }
}

async function confirmReplacement(nonInteractive: boolean): Promise<boolean> {
    const preamble = "This project already has data plane credentials, and Terse cannot show them again."
    if (nonInteractive) {
        log.info(`${preamble} Re-run with ${chalk.cyan("--regenerate-credentials")} to replace them.`)
        return false
    }

    const approved = await confirm({ message: `${preamble} Replace them now?`, default: false })
    if (!approved) {
        log.info("Kept the existing credentials.")
        return false
    }

    log.warn("The current credentials stop working immediately. Update your data plane before its next trigger.")
    return true
}

/** An "already provisioned" answer is indistinguishable from a swallowed failure, so this never
 * degrades to a warning: attach would go on to report credentials it never confirmed. */
function toCredentialsError(error: unknown): CliError {
    return new CliError("credentials_unavailable", "Could not provision this project's data plane credentials.", {
        detail: `${(error as Error).message}\n  Re-run \`terse attach\` once the control plane is reachable.`,
        exitCode: ErrorCode.GENERIC_ERROR
    })
}

function canGenerateFromCurrentDirectory(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}

export type AttachOpts = NonInteractiveOpts & {
    /** Replace the credentials this project already has, without prompting. */
    regenerateCredentials?: boolean
}
