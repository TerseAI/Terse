import { intro, log, outro } from "@clack/prompts"
import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import type { ProjectEnsureCredentialsResponse, SdkOrganizationsListResponse } from "terse-types"

import { fetchWithAuth } from "../api.js"
import { type NonInteractiveOpts, isNonInteractive } from "../cliHelpers.js"
import { createSpinner, logNextSteps, printSelfHostedCredentials } from "../cliUi.js"
import {
    PROJECT_CONFIG_FILENAME,
    createRemoteProject,
    ensureRemoteProjectCredentials,
    readProjectConfig,
    rotateRemoteProjectApiKey,
    rotateRemoteProjectSigningSecret,
    writeProjectConfig
} from "../projectConfig.js"
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

    if (existingUserName) {
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
        const backfilled = await backfillCredentials(attachApiKey, existingConfig.projectId)
        signingSecret = backfilled.signingSecret
        projectApiKey = backfilled.projectApiKey

        const regenerated = await regenerateExistingCredentials(attachApiKey, existingConfig.projectId, {
            hasProjectApiKey: !projectApiKey,
            hasSigningSecret: !signingSecret,
            requested: opts?.regenerateCredentials,
            nonInteractive
        })
        projectApiKey = regenerated.projectApiKey ?? projectApiKey
        signingSecret = regenerated.signingSecret ?? signingSecret
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

async function backfillCredentials(apiKey: string, projectId: string): Promise<ProjectEnsureCredentialsResponse> {
    const s = createSpinner()
    s.start("Checking data plane credentials")
    try {
        const result = await ensureRemoteProjectCredentials(apiKey, projectId)
        s.stop(Object.keys(result).length > 0 ? "Generated the missing data plane credentials" : "Data plane credentials already provisioned")
        return result
    } catch (error) {
        s.stop(`Could not check data plane credentials: ${(error as Error).message}`)
        return {}
    }
}

/**
 * Credentials can only be shown once, so a re-run offers to replace whichever ones already exist.
 * Regenerating revokes the current values immediately, which is why it needs explicit consent.
 */
async function regenerateExistingCredentials(
    apiKey: string,
    projectId: string,
    params: { hasProjectApiKey: boolean; hasSigningSecret: boolean; requested?: boolean; nonInteractive: boolean }
): Promise<ProjectEnsureCredentialsResponse> {
    const targets = [params.hasProjectApiKey ? "project API key" : null, params.hasSigningSecret ? "signing secret" : null].filter((label): label is string => label !== null)
    if (targets.length === 0) return {}

    const labels = targets.join(" and ")
    if (!params.requested) {
        if (params.nonInteractive) {
            const pronoun = targets.length > 1 ? "them" : "it"
            log.info(`This project already has a ${labels}, and Terse cannot show ${pronoun} again. Re-run with ${chalk.cyan("--regenerate-credentials")} to replace ${pronoun}.`)
            return {}
        }

        const approved = await confirm({
            message: `This project already has a ${labels}, and Terse cannot show ${targets.length > 1 ? "them" : "it"} again. Regenerate now?`,
            default: false
        })
        if (!approved) {
            log.info(`Kept the existing ${labels}.`)
            return {}
        }
        log.warn(`The current ${labels} stop${targets.length > 1 ? "" : "s"} working immediately. Update your data plane before its next trigger.`)
    }

    const s = createSpinner()
    s.start(`Regenerating ${labels}`)
    try {
        const projectApiKey = params.hasProjectApiKey ? await rotateRemoteProjectApiKey(apiKey, projectId) : undefined
        const signingSecret = params.hasSigningSecret ? await rotateRemoteProjectSigningSecret(apiKey, projectId) : undefined
        s.stop(`Regenerated ${labels}`)
        return { projectApiKey, signingSecret }
    } catch (error) {
        s.stop(`Could not regenerate the ${labels}: ${(error as Error).message}`)
        return {}
    }
}

function canGenerateFromCurrentDirectory(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}

export type AttachOpts = NonInteractiveOpts & {
    /** Replace the credentials this project already has, without prompting. */
    regenerateCredentials?: boolean
}
