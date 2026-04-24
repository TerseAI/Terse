import { cancel, confirm, group, intro, isCancel, log, outro, password, select, text } from "@clack/prompts"
import { input } from "@inquirer/prompts"
import chalk from "chalk"
import type { CliIntegrationDisplayState, FormIntegrationSetup, IntegrationWithStatus } from "terse-types"
import { INTEGRATION_METADATA, IntegrationType } from "terse-types"

import { readApiKey, readApiKeyOrBail } from "../api.js"
import { createSpinner, formatSummaryList } from "../cliUi.js"
import {
    ConfigurationFieldDefinition,
    FormFieldDefinition,
    disconnectIntegration,
    fetchInstallationUrl,
    fetchIntegrationFields,
    fetchIntegrations,
    pollForConnection,
    submitIntegrationForm
} from "../integrationApi.js"
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

type IntegrationAction = "back" | "connect" | "disconnect" | "keep" | "refresh_permissions"

type GroupedIntegrationSelection = {
    action: IntegrationAction
    integrationType: IntegrationType
}

type UserFacingIntegration = IntegrationWithStatus

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
        continueLoop = abortIfCancelled(
            await confirm({
                message: "Connect another integration?",
                initialValue: false
            })
        )
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
        const addMore = abortIfCancelled(
            await confirm({
                message: "Connect another integration?",
                initialValue: false
            })
        )
        if (addMore) await integrate({ showLifecycle: false, runGenerateAfterChange: options.runGenerateAfterChange })
    } else {
        console.log(chalk.dim("No integrated tools yet."))
        await integrate({ showLifecycle: false, runGenerateAfterChange: options.runGenerateAfterChange })
    }
}

async function connectOneIntegration(apiKey: string): Promise<IntegrationChangeResult> {
    while (true) {
        const integrations = await fetchUserFacingIntegrations(apiKey)

        if (integrations.length === 0) {
            log.warn("No integrations available.")
            return { status: "unchanged" }
        }

        const selection = await promptForIntegrationSelection(integrations)
        if (selection.action === "back") {
            continue
        }

        const selectedIntegration = integrations.find(integration => integration.integrationType === selection.integrationType)
        if (!selectedIntegration) {
            log.warn(`Integration '${selection.integrationType}' is no longer available.`)
            return { status: "unchanged" }
        }

        switch (selection.action) {
            case "keep":
                return { status: "unchanged", integrationType: selection.integrationType }
            case "disconnect": {
                const didDisconnect = await handleDisconnect(apiKey, selection.integrationType)
                return {
                    status: didDisconnect ? "modified" : "unchanged",
                    integrationType: selection.integrationType
                }
            }
            case "connect":
            case "refresh_permissions": {
                const didUpdate = await runInstallationFlow(apiKey, selection.integrationType)
                return {
                    status: didUpdate ? (selectedIntegration.isActive ? "modified" : "added") : "unchanged",
                    integrationType: selection.integrationType
                }
            }
        }
    }
}

async function fetchUserFacingIntegrations(apiKey: string): Promise<UserFacingIntegration[]> {
    const s = createSpinner()
    s.start("Fetching integrations")

    try {
        const integrations = await fetchIntegrations(apiKey)
        s.stop("Fetched integrations")
        return integrations.filter(i => i.integrationType !== IntegrationType.TERSE && i.integrationType !== IntegrationType.CRON_JOB && i.integrationType !== IntegrationType.WEBMONITOR)
    } catch (err: any) {
        s.stop("Failed to fetch integrations")
        console.error(chalk.red(`  ${err.message}`))
        process.exit(1)
    }
}

async function promptForIntegrationSelection(integrations: UserFacingIntegration[]): Promise<GroupedIntegrationSelection> {
    const longestName = integrations.reduce((max, integration) => Math.max(max, getIntegrationDisplayName(integration).length), 0)

    return group(
        {
            integrationType: () =>
                select({
                    message: "Choose an integration",
                    options: integrations.map(integration => ({
                        value: integration.integrationType,
                        label: formatIntegrationPickerLabel(integration, longestName)
                    }))
                }),
            action: ({ results }) => {
                const selectedType = results.integrationType as IntegrationType
                const selectedIntegration = integrations.find(integration => integration.integrationType === selectedType)
                if (!selectedIntegration) {
                    throw new Error(`Integration '${selectedType}' is no longer available`)
                }

                return select({
                    message: getIntegrationDisplayName(selectedIntegration),
                    options: getIntegrationActions(selectedIntegration).map(action => ({
                        value: action,
                        label: formatIntegrationActionLabel(action)
                    }))
                })
            }
        },
        {
            onCancel: () => {
                cancel("Operation cancelled.")
                process.exit(0)
            }
        }
    ) as Promise<GroupedIntegrationSelection>
}

function getIntegrationActions(integration: UserFacingIntegration): IntegrationAction[] {
    if (integration.cliDisplayState.status === "connected") {
        return ["keep", "disconnect", "refresh_permissions"]
    }

    return ["connect", "back"]
}

function formatIntegrationActionLabel(action: IntegrationAction): string {
    switch (action) {
        case "keep":
            return "Keep this connection"
        case "disconnect":
            return "Disconnect"
        case "refresh_permissions":
            return "Refresh permissions"
        case "connect":
            return "Connect"
        case "back":
            return "Back"
        default:
            const exhaustiveCheck: never = action
            throw new Error(`Unhandled integration action: ${exhaustiveCheck}`)
    }
}

function formatIntegrationPickerLabel(integration: UserFacingIntegration, longestName: number): string {
    const name = getIntegrationDisplayName(integration).padEnd(longestName)
    const summary = formatIntegrationDisplaySummary(integration.cliDisplayState)
    return `${name}  ${chalk.dim(summary)}`
}

function formatIntegrationDisplaySummary(displayState: CliIntegrationDisplayState): string {
    if (displayState.status === "connected") {
        return `${displayState.summaryLabel}: ${displayState.summaryValue}`
    }

    return "Not connected"
}

function getIntegrationDisplayName(integration: UserFacingIntegration): string {
    return INTEGRATION_METADATA[integration.integrationType]?.name || integration.integrationType
}

async function runInstallationFlow(apiKey: string, integrationType: IntegrationType): Promise<boolean> {
    const s = createSpinner()
    s.start("Loading integration details")

    try {
        const fieldsResponse = await fetchIntegrationFields(apiKey, integrationType)
        s.stop("Loaded integration details")

        if (fieldsResponse.installationType === "form") {
            return handleFormIntegration(apiKey, integrationType, fieldsResponse.fields as FormFieldDefinition[], fieldsResponse.setup)
        }

        if (fieldsResponse.installationType === "oauth") {
            return handleOAuthIntegration(apiKey, integrationType, fieldsResponse.fields as ConfigurationFieldDefinition[])
        }
    } catch (err: any) {
        s.stop("Failed to load integration details")
        console.error(chalk.red(`  ${err.message}`))
        return false
    }

    log.warn(`Integration '${integrationType}' has an unsupported installation type.`)
    return false
}

async function handleFormIntegration(apiKey: string, integrationType: IntegrationType, fields: FormFieldDefinition[], setup?: FormIntegrationSetup): Promise<boolean> {
    await showFormSetupGuidance(integrationType, setup)

    const formValues: Record<string, string> = {}
    for (const field of fields) {
        const promptMessage = buildFieldPromptMessage(field)

        if (field.type === "password") {
            formValues[field.name] = abortIfCancelled(
                await password({
                    message: promptMessage,
                    validate: field.required ? value => ((value?.length ?? 0) > 0 ? undefined : `${field.label} is required`) : undefined
                })
            )
            continue
        }

        if (field.type === "textarea") {
            formValues[field.name] = await input({
                message: promptMessage,
                default: field.placeholder,
                validate: field.required ? value => (value.length > 0 ? true : `${field.label} is required`) : undefined
            })
            continue
        }

        formValues[field.name] = abortIfCancelled(
            await text({
                message: promptMessage,
                placeholder: field.placeholder,
                validate: field.required ? value => ((value?.length ?? 0) > 0 ? undefined : `${field.label} is required`) : undefined
            })
        )
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

async function showFormSetupGuidance(integrationType: IntegrationType, setup?: FormIntegrationSetup): Promise<void> {
    if (!setup) return

    log.info(chalk.bold(`${INTEGRATION_METADATA[integrationType]?.name || integrationType} setup`))
    console.log(chalk.cyan(setup.url))
    console.log(chalk.dim(setup.title))

    for (const instruction of setup.instructions) {
        console.log(`  ${chalk.dim("•")} ${instruction}`)
    }

    console.log("")

    const shouldOpenSetupUrl = abortIfCancelled(
        await confirm({
            message: "Open setup instructions in your browser?",
            initialValue: false
        })
    )

    if (shouldOpenSetupUrl) {
        openUrlInBrowser(setup.url)
    }
}

function buildFieldPromptMessage(field: FormFieldDefinition): string {
    return field.hint ? `${field.label} ${chalk.dim(`(${field.hint})`)}` : field.label
}

async function handleOAuthIntegration(apiKey: string, integrationType: IntegrationType, configFields: ConfigurationFieldDefinition[]): Promise<boolean> {
    let options: Record<string, string> | undefined
    if (configFields.length > 0) {
        options = {}
        for (const field of configFields) {
            const value = abortIfCancelled(
                await select({
                    message: field.label,
                    options: field.options.map(option => ({ value: option.value, label: option.label }))
                })
            )
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

async function handleDisconnect(apiKey: string, integrationType: IntegrationType): Promise<boolean> {
    const s = createSpinner()
    s.start("Disconnecting integration")

    try {
        const result = await disconnectIntegration(apiKey, integrationType)
        if (result.success) {
            s.stop("Integration disconnected successfully")
            return true
        }

        s.stop(`Failed to disconnect: ${result.error || "Unknown error"}`)
        return false
    } catch (err: any) {
        s.stop("Failed to disconnect integration")
        console.error(chalk.red(`  ${err.message}`))
        return false
    }
}

function abortIfCancelled<T>(value: T | symbol): T {
    if (isCancel(value)) {
        cancel("Operation cancelled.")
        process.exit(0)
    }

    return value
}
