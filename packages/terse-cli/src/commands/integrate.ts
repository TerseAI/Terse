import { intro, log, outro } from "@clack/prompts"
import { confirm, input, password, select } from "@inquirer/prompts"
import chalk from "chalk"
import { INTEGRATION_METADATA, IntegrationType } from "terse-types"

import { readApiKey, readApiKeyOrBail } from "../api.js"
import { createSpinner, formatSummaryList } from "../cliUi.js"
import { ConfigurationFieldDefinition, FormFieldDefinition, fetchInstallationUrl, fetchIntegrationFields, fetchIntegrations, pollForConnection, submitIntegrationForm } from "../integrationApi.js"
import { openUrlInBrowser } from "../openBrowser.js"

import { generate } from "./generate.js"

type IntegrationChangeResult = {
    status: "added" | "modified" | "unchanged"
    integrationType?: IntegrationType
}

type IntegrateOptions = {
    showLifecycle?: boolean
    runGenerateAfterChange?: boolean
}

export async function integrate(options: IntegrateOptions = {}): Promise<void> {
    const showLifecycle = options.showLifecycle ?? true
    const runGenerateAfterChange = options.runGenerateAfterChange ?? true

    if (showLifecycle) {
        intro("terse integrate")
    }

    const apiKey = readApiKeyOrBail()
    let didChangeAnyIntegration = false

    let continueLoop = true
    while (continueLoop) {
        const result = await connectOneIntegration(apiKey)
        didChangeAnyIntegration = didChangeAnyIntegration || result.status !== "unchanged"
        continueLoop = await confirm({ message: "Connect another integration?", default: false })
    }

    if (didChangeAnyIntegration && runGenerateAfterChange) {
        await generate(undefined, { showLifecycle: false })
    }

    if (showLifecycle) {
        outro("Done")
    }
}

export async function listAndPromptIntegrations(options: IntegrateOptions = {}): Promise<void> {
    const apiKey = readApiKey()
    if (!apiKey) return

    const s = createSpinner()
    s.start("Fetching integrations")

    let integrations
    try {
        integrations = await fetchIntegrations(apiKey)
        s.stop("Fetched integrations")
    } catch {
        s.stop("Failed to fetch integrations")
        console.error(chalk.red("Failed to fetch integrations"))
        return
    }

    const active = integrations.filter(i => i.isActive && i.integrationType !== IntegrationType.TERSE && i.integrationType !== IntegrationType.CRON_JOB)

    if (active.length > 0) {
        const names = active.map(i => INTEGRATION_METADATA[i.integrationType]?.name || i.integrationType)
        console.log(chalk.dim(`Connected integrations (${active.length}): ${formatSummaryList(names)}`))
        const addMore = await confirm({ message: "Connect another integration?", default: false })
        if (addMore) await integrate({ showLifecycle: false, runGenerateAfterChange: options.runGenerateAfterChange })
    } else {
        console.log(chalk.dim("No integrated tools yet."))
        await integrate({ showLifecycle: false, runGenerateAfterChange: options.runGenerateAfterChange })
    }
}

async function connectOneIntegration(apiKey: string): Promise<IntegrationChangeResult> {
    const s = createSpinner()
    s.start("Fetching integrations")

    let integrations
    try {
        integrations = await fetchIntegrations(apiKey)
        s.stop("Fetched integrations")
    } catch (err: any) {
        s.stop("Failed to fetch integrations")
        console.error(chalk.red(`  ${err.message}`))
        process.exit(1)
    }

    const userFacing = integrations.filter(i => i.integrationType !== IntegrationType.TERSE && i.integrationType !== IntegrationType.CRON_JOB && i.integrationType !== IntegrationType.WEBMONITOR)

    if (userFacing.length === 0) {
        log.warn("No integrations available.")
        return { status: "unchanged" }
    }

    const selected = await select({
        message: "Select an integration to connect",
        choices: userFacing.map(i => {
            const meta = INTEGRATION_METADATA[i.integrationType]
            const name = meta?.name || i.integrationType
            const status = i.isActive ? chalk.green(" connected") : chalk.dim(" not connected")
            return {
                name: `${name}${status}`,
                value: i.integrationType,
                description: meta?.description
            }
        })
    })
    const selectedIntegration = userFacing.find(i => i.integrationType === selected)

    s.start("Loading integration details")

    let fieldsResponse
    try {
        fieldsResponse = await fetchIntegrationFields(apiKey, selected)
        s.stop("Loaded integration details")
    } catch (err: any) {
        s.stop("Failed to load integration details")
        console.error(chalk.red(`  ${err.message}`))
        process.exit(1)
    }

    if (fieldsResponse.installationType === "form") {
        const didUpdate = await handleFormIntegration(apiKey, selected, fieldsResponse.fields as FormFieldDefinition[])
        return {
            status: didUpdate ? (selectedIntegration?.isActive ? "modified" : "added") : "unchanged",
            integrationType: selected
        }
    }
    if (fieldsResponse.installationType === "oauth") {
        const didUpdate = await handleOAuthIntegration(apiKey, selected, fieldsResponse.fields as ConfigurationFieldDefinition[])
        return {
            status: didUpdate ? (selectedIntegration?.isActive ? "modified" : "added") : "unchanged",
            integrationType: selected
        }
    }

    log.warn(`Integration '${selected}' has an unsupported installation type.`)
    return {
        status: "unchanged",
        integrationType: selected
    }
}

async function handleFormIntegration(apiKey: string, integrationType: string, fields: FormFieldDefinition[]): Promise<boolean> {
    const formValues: Record<string, string> = {}
    for (const field of fields) {
        const hint = field.hint ? chalk.dim(` (${field.hint})`) : ""

        if (field.type === "password") {
            formValues[field.name] = await password({
                message: `${field.label}${hint}`,
                validate: field.required ? v => (v.length > 0 ? true : `${field.label} is required`) : undefined
            })
        } else {
            formValues[field.name] = await input({
                message: `${field.label}${hint}`,
                default: field.placeholder,
                validate: field.required ? v => (v.length > 0 ? true : `${field.label} is required`) : undefined
            })
        }
    }

    const s = createSpinner()
    s.start("Connecting integration")
    try {
        const result = await submitIntegrationForm(apiKey, integrationType, formValues)
        if (result.success) {
            s.stop("Integration connected successfully")
            return true
        }
        s.stop(`Failed to connect: ${result.error || "Unknown error"}`)
        return false
    } catch (err: any) {
        s.stop("Failed to connect integration")
        console.error(chalk.red(`  ${err.message}`))
        return false
    }
}

async function handleOAuthIntegration(apiKey: string, integrationType: string, configFields: ConfigurationFieldDefinition[]): Promise<boolean> {
    let options: Record<string, string> | undefined
    if (configFields.length > 0) {
        options = {}
        for (const field of configFields) {
            const value = await select({
                message: field.label,
                choices: field.options.map(o => ({ name: o.label, value: o.value }))
            })
            options[field.name] = value
        }
    }

    const s = createSpinner()
    s.start("Getting authorization URL")

    let installationDetails
    try {
        installationDetails = await fetchInstallationUrl(apiKey, integrationType, options)
        s.stop("Authorization URL ready")
    } catch (err: any) {
        s.stop("Failed to get authorization URL")
        console.error(chalk.red(`  ${err.message}`))
        return false
    }

    log.info(`Complete authorization in your browser: ${chalk.cyan(installationDetails.oauthUrl)}`)
    openUrlInBrowser(installationDetails.oauthUrl)

    s.start("Waiting for authorization to complete")
    const connected = await pollForConnection(apiKey, integrationType)

    if (connected) {
        s.stop("Integration connected successfully")
        return true
    }

    s.stop("Authorization timed out — please try again")
    return false
}
