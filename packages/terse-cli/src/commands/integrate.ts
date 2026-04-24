import { cancel, confirm, group, intro, isCancel, log, outro, password, select, text } from "@clack/prompts"
import { input } from "@inquirer/prompts"
import chalk from "chalk"
import type { CliIntegrationDisplayState, FormIntegrationSetup, IntegrationWithStatus } from "terse-types"
import { INTEGRATION_METADATA, IntegrationType } from "terse-types"

import { readApiKey, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
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
import { type NonInteractiveOpts, isNonInteractive, parseKeyValueFlags, readFieldsFromStdin } from "../nonInteractive.js"
import { openUrlInBrowser } from "../openBrowser.js"

import { generate } from "./generate.js"

type IntegrationChangeResult = {
    status: "added" | "modified" | "unchanged"
    integrationType?: IntegrationType
}

type IntegrateOptions = {
    showLifecycle?: boolean
    runGenerateAfterChange?: boolean
    nonInteractive?: boolean
}

type IntegrationAction = "back" | "connect" | "disconnect" | "keep" | "refresh_permissions"

type GroupedIntegrationSelection = {
    action: IntegrationAction
    integrationType: IntegrationType
}

type UserFacingIntegration = IntegrationWithStatus

const INTERNAL_INTEGRATION_TYPES = new Set<string>([IntegrationType.TERSE, IntegrationType.CRON_JOB, IntegrationType.WEBMONITOR])

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

    const active = integrations.filter(i => i.isActive && !INTERNAL_INTEGRATION_TYPES.has(i.integrationType))

    if (options.nonInteractive || isNonInteractive()) {
        if (active.length > 0) {
            const names = active.map(i => INTEGRATION_METADATA[i.integrationType]?.name || i.integrationType)
            console.log(chalk.dim(`Connected integrations (${active.length}): ${formatSummaryList(names)}`))
        } else {
            console.log(chalk.dim("No integrated tools yet. Run `terse integrate` in an interactive terminal to connect some."))
        }
        return
    }

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
        return integrations.filter(i => !INTERNAL_INTEGRATION_TYPES.has(i.integrationType))
    } catch (err: any) {
        s.stop("Failed to fetch integrations")
        throw new CliError("fetch_integrations_failed", err?.message ?? "Failed to fetch integrations.")
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

// -------------------------------------------------------------------------
// Non-interactive subcommands
// -------------------------------------------------------------------------

function parseIntegrationTypeOrThrow(value: string): IntegrationType {
    const normalized = value.toLowerCase()
    const match = Object.values(IntegrationType).find(v => v === normalized)
    if (!match) {
        throw new CliError("unknown_integration_type", `Unknown integration type "${value}".`, {
            detail: `Supported: ${Object.values(IntegrationType)
                .filter(v => !INTERNAL_INTEGRATION_TYPES.has(v))
                .join(", ")}`
        })
    }
    return match as IntegrationType
}

function summaryFor(displayState: CliIntegrationDisplayState): { summaryLabel: string | null; summaryValue: string | null } {
    if (displayState.status === "connected") {
        return { summaryLabel: displayState.summaryLabel, summaryValue: displayState.summaryValue }
    }
    return { summaryLabel: null, summaryValue: null }
}

export type IntegrateListOpts = {
    json?: boolean
    status?: "connected" | "disconnected"
}

export async function integrateList(opts: IntegrateListOpts = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const integrations = (await fetchIntegrations(apiKey)).filter(i => !INTERNAL_INTEGRATION_TYPES.has(i.integrationType))

    const filtered = integrations.filter(i => {
        if (opts.status === "connected") return i.isActive
        if (opts.status === "disconnected") return !i.isActive
        return true
    })

    if (opts.json) {
        const payload = {
            integrations: await Promise.all(
                filtered.map(async integration => {
                    const { summaryLabel, summaryValue } = summaryFor(integration.cliDisplayState)
                    return {
                        type: integration.integrationType,
                        status: integration.isActive ? "connected" : "disconnected",
                        name: INTEGRATION_METADATA[integration.integrationType]?.name ?? integration.integrationType,
                        summaryLabel,
                        summaryValue
                    }
                })
            )
        }
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    if (filtered.length === 0) {
        process.stdout.write("No integrations.\n")
        return
    }

    const longest = filtered.reduce((max, i) => Math.max(max, (INTEGRATION_METADATA[i.integrationType]?.name ?? i.integrationType).length), 0)
    for (const integration of filtered) {
        const name = (INTEGRATION_METADATA[integration.integrationType]?.name ?? integration.integrationType).padEnd(longest)
        const status = integration.isActive ? chalk.green("connected") : chalk.dim("not connected")
        const summary = formatIntegrationDisplaySummary(integration.cliDisplayState)
        process.stdout.write(`  ${name}  ${status}  ${chalk.dim(summary)}\n`)
    }
}

export type IntegrateDescribeOpts = {
    integrationType: string
    json?: boolean
}

export async function integrateDescribe(opts: IntegrateDescribeOpts): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const apiKey = readApiKeyOrBail()

    const [integrations, fieldsResponse] = await Promise.all([fetchIntegrations(apiKey), fetchIntegrationFields(apiKey, type)])
    const match = integrations.find(i => i.integrationType === type)

    const payload = {
        type,
        name: INTEGRATION_METADATA[type]?.name ?? type,
        status: match?.isActive ? "connected" : "disconnected",
        installationType: fieldsResponse.installationType,
        fields: fieldsResponse.fields,
        setup: fieldsResponse.setup ?? null
    }

    if (opts.json) {
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    process.stdout.write(`${chalk.bold(payload.name)}  ${payload.status === "connected" ? chalk.green("connected") : chalk.dim("not connected")}\n`)
    process.stdout.write(`Installation: ${payload.installationType}\n\n`)
    if (payload.installationType === "form") {
        process.stdout.write("Fields:\n")
        for (const field of payload.fields as FormFieldDefinition[]) {
            const req = field.required ? chalk.yellow(" (required)") : chalk.dim(" (optional)")
            const hint = field.hint ? ` — ${field.hint}` : ""
            process.stdout.write(`  ${chalk.cyan(field.name)} [${field.type}]${req}${chalk.dim(hint)}\n`)
        }
        if (payload.setup) {
            process.stdout.write(`\nSetup: ${chalk.cyan(payload.setup.url)}\n`)
        }
    } else {
        process.stdout.write("OAuth — use `terse integrate connect <type>` in an interactive terminal, or open the auth URL manually and poll with `terse integrate wait`.\n")
    }
}

export type IntegrateConnectOpts = {
    integrationType: string
    fieldFlags?: string[]
    fieldsStdin?: boolean
    force?: boolean
    json?: boolean
}

export async function integrateConnect(opts: IntegrateConnectOpts): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const apiKey = readApiKeyOrBail()

    const [integrations, fieldsResponse] = await Promise.all([fetchIntegrations(apiKey), fetchIntegrationFields(apiKey, type)])
    const existing = integrations.find(i => i.integrationType === type)

    if (existing?.isActive && !opts.force) {
        const message = `${INTEGRATION_METADATA[type]?.name ?? type} is already connected. Pass --force to refresh.`
        if (opts.json) {
            process.stdout.write(JSON.stringify({ type, status: "connected", changed: false, message }, null, 2) + "\n")
        } else {
            process.stdout.write(chalk.dim(message) + "\n")
        }
        return
    }

    if (fieldsResponse.installationType === "oauth") {
        const installation = await fetchInstallationUrl(apiKey, type)
        throw new CliError("oauth_requires_browser", "OAuth integrations cannot be connected non-interactively.", {
            detail: `Open the URL in a browser, then run \`terse integrate wait ${type}\` to block until authorization completes.`,
            url: installation.oauthUrl,
            actionRequired: true,
            exitCode: 2
        })
    }

    const formFields = fieldsResponse.fields as FormFieldDefinition[]
    const fromFlags = parseKeyValueFlags(opts.fieldFlags)
    const fromStdin = opts.fieldsStdin ? await readFieldsFromStdin() : {}
    const provided = { ...fromFlags, ...fromStdin }

    const knownFieldNames = new Set(formFields.map(f => f.name))
    const unknown = Object.keys(provided).filter(name => !knownFieldNames.has(name))
    if (unknown.length > 0) {
        throw new CliError("unknown_fields", `Unknown field(s): ${unknown.join(", ")}`, {
            detail: `Valid fields: ${formFields.map(f => f.name).join(", ")}`
        })
    }

    const missing = formFields.filter(f => f.required && !provided[f.name]).map(f => f.name)
    if (missing.length > 0) {
        throw new CliError("missing_fields", `Missing required field(s): ${missing.join(", ")}`, {
            detail: `Run \`terse integrate describe ${type} --json\` to see the full field schema.`
        })
    }

    const result = await submitIntegrationForm(apiKey, type, provided)
    if (!result.success) {
        throw new CliError("connect_failed", result.error ?? "Failed to connect integration.")
    }

    const message = existing?.isActive ? `${type} refreshed.` : `${type} connected.`
    if (opts.json) {
        process.stdout.write(JSON.stringify({ type, status: "connected", changed: true, message }, null, 2) + "\n")
    } else {
        process.stdout.write(chalk.green(message) + "\n")
    }
}

export type IntegrateDisconnectOpts = {
    integrationType: string
    json?: boolean
}

export async function integrateDisconnect(opts: IntegrateDisconnectOpts): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const apiKey = readApiKeyOrBail()

    const result = await disconnectIntegration(apiKey, type)
    if (!result.success) {
        throw new CliError("disconnect_failed", result.error ?? "Failed to disconnect integration.")
    }

    const message = `${type} disconnected.`
    if (opts.json) {
        process.stdout.write(JSON.stringify({ type, status: "disconnected", changed: true, message }, null, 2) + "\n")
    } else {
        process.stdout.write(chalk.green(message) + "\n")
    }
}

export type IntegrateWaitOpts = {
    integrationType: string
    timeoutSeconds?: number
    json?: boolean
}

const WAIT_DEFAULT_TIMEOUT_S = 300
const WAIT_MAX_TIMEOUT_S = 900
const WAIT_INTERVAL_MS = 2000

export async function integrateWait(opts: IntegrateWaitOpts): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const requested = opts.timeoutSeconds ?? WAIT_DEFAULT_TIMEOUT_S
    const timeoutSeconds = Math.max(1, Math.min(WAIT_MAX_TIMEOUT_S, requested))
    const apiKey = readApiKeyOrBail()

    const deadline = Date.now() + timeoutSeconds * 1000
    let lastError: string | null = null

    while (Date.now() < deadline) {
        try {
            const integrations = await fetchIntegrations(apiKey)
            const match = integrations.find(i => i.integrationType === type)
            if (match?.isActive) {
                const message = `${type} is connected.`
                if (opts.json) {
                    process.stdout.write(JSON.stringify({ type, status: "connected", message }, null, 2) + "\n")
                } else {
                    process.stdout.write(chalk.green(message) + "\n")
                }
                return
            }
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err)
        }
        await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS))
    }

    throw new CliError("wait_timeout", `Timed out after ${timeoutSeconds}s waiting for ${type} to connect.`, {
        detail: lastError ? `Last error: ${lastError}` : "Check the integration's connection status with `terse integrate list`."
    })
}
