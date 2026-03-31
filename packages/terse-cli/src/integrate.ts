import { spawn } from "node:child_process"
import chalk from "chalk"
import { confirm, input, password, select } from "@inquirer/prompts"
import ora from "ora"
import { readApiKey } from "./api.js"
import {
    ConfigurationFieldDefinition,
    FormFieldDefinition,
    fetchIntegrationFields,
    fetchInstallationUrl,
    fetchIntegrations,
    pollForConnection,
    submitIntegrationForm
} from "./integrationApi.js"
import { INTEGRATION_METADATA, IntegrationType } from "./shared/Integrations.js"

export async function integrate(): Promise<void> {
    const apiKey = readApiKey()
    if (!apiKey) {
        console.log(chalk.red("\n  Not authenticated. Run `terse login` first.\n"))
        process.exit(1)
    }

    let continueLoop = true
    while (continueLoop) {
        await connectOneIntegration(apiKey)

        console.log("")
        continueLoop = await confirm({ message: "Connect another integration?", default: false })
    }
}

async function connectOneIntegration(apiKey: string): Promise<void> {
    const spinner = ora("Fetching integrations").start()
    let integrations
    try {
        integrations = await fetchIntegrations(apiKey)
        spinner.stop()
    } catch (err: any) {
        spinner.fail("Failed to fetch integrations")
        console.error(chalk.red(`  ${err.message}`))
        process.exit(1)
    }

    // Filter out system integrations
    const userFacing = integrations.filter(
        i => i.integrationType !== IntegrationType.TERSE && i.integrationType !== IntegrationType.CRON_JOB
    )

    if (userFacing.length === 0) {
        console.log(chalk.yellow("\n  No integrations available.\n"))
        return
    }

    const selected = await select({
        message: "Select an integration to connect",
        choices: userFacing.map(i => {
            const meta = INTEGRATION_METADATA[i.integrationType]
            const name = meta?.name || i.integrationType
            const status = i.isActive ? chalk.green(" ✓ connected") : chalk.dim(" not connected")
            return {
                name: `${name}${status}`,
                value: i.integrationType,
                description: meta?.description
            }
        })
    })

    // Fetch fields for the selected integration
    const fieldsSpinner = ora("Loading integration details").start()
    let fieldsResponse
    try {
        fieldsResponse = await fetchIntegrationFields(apiKey, selected)
        fieldsSpinner.stop()
    } catch (err: any) {
        fieldsSpinner.fail("Failed to load integration details")
        console.error(chalk.red(`  ${err.message}`))
        process.exit(1)
    }

    if (fieldsResponse.installationType === "form") {
        await handleFormIntegration(apiKey, selected, fieldsResponse.fields as FormFieldDefinition[])
    } else if (fieldsResponse.installationType === "oauth") {
        await handleOAuthIntegration(apiKey, selected, fieldsResponse.fields as ConfigurationFieldDefinition[])
    } else {
        console.log(chalk.yellow(`\n  Integration '${selected}' has an unsupported installation type.\n`))
    }
}

// ─── Form-based integrations (Datadog, PostHog, Snowflake, etc.) ─────────────

async function handleFormIntegration(apiKey: string, integrationType: string, fields: FormFieldDefinition[]): Promise<void> {
    console.log("")

    const formValues: Record<string, string> = {}
    for (const field of fields) {
        const hint = field.hint ? chalk.dim(` (${field.hint})`) : ""

        if (field.type === "password") {
            formValues[field.name] = await password({
                message: `${field.label}${hint}`,
                validate: field.required ? (v) => (v.length > 0 ? true : `${field.label} is required`) : undefined
            })
        } else {
            formValues[field.name] = await input({
                message: `${field.label}${hint}`,
                default: field.placeholder,
                validate: field.required ? (v) => (v.length > 0 ? true : `${field.label} is required`) : undefined
            })
        }
    }

    const spinner = ora("Connecting integration").start()
    try {
        const result = await submitIntegrationForm(apiKey, integrationType, formValues)
        if (result.success) {
            spinner.succeed(chalk.green("Integration connected successfully"))
        } else {
            spinner.fail(`Failed to connect: ${result.error || "Unknown error"}`)
        }
    } catch (err: any) {
        spinner.fail("Failed to connect integration")
        console.error(chalk.red(`  ${err.message}`))
    }
}

// ─── OAuth-based integrations (Slack, GitHub, Gmail, etc.) ───────────────────

async function handleOAuthIntegration(apiKey: string, integrationType: string, configFields: ConfigurationFieldDefinition[]): Promise<void> {
    // Prompt for configuration fields if any (e.g. Slack's bot vs user choice)
    let options: Record<string, string> | undefined
    if (configFields.length > 0) {
        console.log("")
        options = {}
        for (const field of configFields) {
            const value = await select({
                message: field.label,
                choices: field.options.map(o => ({ name: o.label, value: o.value }))
            })
            options[field.name] = value
        }
    }

    const spinner = ora("Getting authorization URL").start()
    let installationDetails
    try {
        installationDetails = await fetchInstallationUrl(apiKey, integrationType, options)
        spinner.stop()
    } catch (err: any) {
        spinner.fail("Failed to get authorization URL")
        console.error(chalk.red(`  ${err.message}`))
        return
    }

    console.log(`\n  ${chalk.bold("Complete authorization in your browser:")}\n`)
    console.log(`  ${chalk.cyan(installationDetails.oauthUrl)}\n`)
    openInBrowser(installationDetails.oauthUrl)

    const pollSpinner = ora("Waiting for authorization to complete").start()
    const connected = await pollForConnection(apiKey, integrationType)

    if (connected) {
        pollSpinner.succeed(chalk.green("Integration connected successfully"))
    } else {
        pollSpinner.fail("Authorization timed out — please try again")
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openInBrowser(url: string): boolean {
    try {
        if (process.platform === "darwin") {
            spawn("open", [url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        if (process.platform === "win32") {
            spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref()
        return true
    } catch {
        return false
    }
}
