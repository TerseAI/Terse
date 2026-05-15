import { cancel, isCancel, password } from "@clack/prompts"
import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import { ApiRoutes, buildRoute } from "terse-types"
import type { ProjectSecretUpsertRequest, ProjectSecretsImportResponse, ProjectSecretsListResponse } from "terse-types"

import { fetchWithAuth, fetchWithAuthNoResponse, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { readProjectConfigOrBail } from "../projectConfig.js"

const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
const MAX_SECRET_VALUE_BYTES = 32 * 1024

export async function secretsList(opts: { json?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    const response = await fetchWithAuth<ProjectSecretsListResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.LIST, { id: config.projectId }), apiKey)

    if (opts.json) {
        process.stdout.write(
            JSON.stringify(
                {
                    secrets: response.secrets.map(secret => ({ name: secret.name }))
                },
                null,
                2
            ) + "\n"
        )
        return
    }

    if (response.secrets.length === 0) {
        process.stdout.write("No project secrets.\n")
        return
    }

    process.stdout.write(`Project secrets for ${chalk.cyan(config.name)}:\n\n`)
    for (const secret of response.secrets) {
        process.stdout.write(`  ${chalk.cyan(secret.name)}\n`)
    }
}

export async function secretsAdd(name: string, opts: { valueStdin?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    validateSecretNameOrThrow(name)

    const value = opts.valueStdin ? await readValueFromStdin() : await promptForSecretValue(name)
    validateSecretValueOrThrow(value)

    const body: ProjectSecretUpsertRequest = { name, value }
    await fetchWithAuthNoResponse(buildRoute(ApiRoutes.PROJECT_SECRETS.UPSERT, { id: config.projectId }), apiKey, body, "POST")

    process.stdout.write(chalk.green(`Secret ${name} saved.\n`))
}

export async function secretsRemove(name: string, opts: { yes?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    validateSecretNameOrThrow(name)

    if (!opts.yes) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            throw new CliError("confirmation_required", "Refusing to remove a secret without confirmation.", {
                detail: "Pass --yes to confirm non-interactively."
            })
        }
        const approved = await confirm({ message: `Remove secret ${name} from project ${config.name}?`, default: false })
        if (!approved) {
            process.stdout.write("Cancelled.\n")
            return
        }
    }

    await fetchWithAuthNoResponse(buildRoute(ApiRoutes.PROJECT_SECRETS.DELETE, { id: config.projectId, name }), apiKey, {}, "DELETE")

    process.stdout.write(chalk.green(`Secret ${name} removed.\n`))
}

export async function secretsImport(filePath: string, opts: { overwrite?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    const parsed = parseEnvFile(readTextFile(filePath))

    const rejected = [...parsed.rejected]
    let entries = parsed.entries

    if (!opts.overwrite && entries.length > 0) {
        const existing = await fetchWithAuth<ProjectSecretsListResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.LIST, { id: config.projectId }), apiKey)
        const existingNames = new Set(existing.secrets.map(secret => secret.name))
        entries = entries.filter(entry => {
            if (!existingNames.has(entry.name)) return true
            rejected.push({ name: entry.name, reason: "Already exists; pass --overwrite to update it" })
            return false
        })
    }

    let response: ProjectSecretsImportResponse = { added: [], updated: [], rejected: [] }
    if (entries.length > 0) {
        response = await fetchWithAuth<ProjectSecretsImportResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.IMPORT, { id: config.projectId }), apiKey, { entries }, "POST")
    }

    const accepted = [...response.added, ...response.updated]
    const allRejected = [...rejected, ...response.rejected]
    process.stdout.write(chalk.green(`Imported ${accepted.length} secret${accepted.length === 1 ? "" : "s"}.\n`))
    if (allRejected.length > 0) {
        process.stdout.write(chalk.yellow(`Skipped ${allRejected.length} entr${allRejected.length === 1 ? "y" : "ies"}:\n`))
        for (const item of allRejected) {
            process.stdout.write(`  ${item.name}: ${item.reason}\n`)
        }
    }
}

export function parseEnvFile(raw: string): { entries: ProjectSecretUpsertRequest[]; rejected: Array<{ name: string; reason: string }> } {
    const entries: ProjectSecretUpsertRequest[] = []
    const rejected: Array<{ name: string; reason: string }> = []

    for (const [index, line] of raw.split(/\r?\n/).entries()) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue

        const separatorIndex = line.indexOf("=")
        if (separatorIndex <= 0) {
            rejected.push({ name: `line ${index + 1}`, reason: "Expected KEY=VALUE" })
            continue
        }

        const name = line.slice(0, separatorIndex).trim()
        const nameError = validateSecretName(name)
        if (nameError) {
            rejected.push({ name, reason: nameError })
            continue
        }

        const value = parseEnvValue(line.slice(separatorIndex + 1))
        const valueError = validateSecretValue(value)
        if (valueError) {
            rejected.push({ name, reason: valueError })
            continue
        }

        entries.push({ name, value })
    }

    return { entries, rejected }
}

function parseEnvValue(rawValue: string): string {
    let value = rawValue.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
        if (rawValue.trim().startsWith('"')) {
            value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
        }
        return value
    }

    return value.replace(/\s+#.*$/, "")
}

async function promptForSecretValue(name: string): Promise<string> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new CliError("value_required", "Secret value required.", {
            detail: "Pass --value-stdin and pipe the value on stdin."
        })
    }

    const value = await password({
        message: `Value for ${name}`,
        validate: input => (Buffer.byteLength(input ?? "", "utf8") > MAX_SECRET_VALUE_BYTES ? `Secret value must be ${MAX_SECRET_VALUE_BYTES} bytes or less` : undefined)
    })
    if (isCancel(value)) {
        cancel("Operation cancelled.")
        process.exit(0)
    }

    return value
}

async function readValueFromStdin(): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks)
        .toString("utf8")
        .replace(/\r?\n$/, "")
}

function readTextFile(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf8")
    } catch (error) {
        throw new CliError("env_file_unreadable", `Could not read ${filePath}.`, {
            detail: error instanceof Error ? error.message : String(error)
        })
    }
}

function validateSecretNameOrThrow(name: string): void {
    const error = validateSecretName(name)
    if (error) {
        throw new CliError("invalid_secret_name", error)
    }
}

function assertManagedProjectConfig(config: { selfHosted?: boolean }): void {
    if (config.selfHosted) {
        throw new CliError("managed_project_required", "Project secrets are only supported for managed projects.", {
            detail: "Self-hosted projects should keep managing runtime environment variables directly."
        })
    }
}

function validateSecretName(name: string): string | null {
    if (!SECRET_NAME_PATTERN.test(name)) {
        return "Secret names must match ^[A-Z][A-Z0-9_]{0,63}$"
    }
    if (name.startsWith("TERSE_")) {
        return "Secret names cannot start with TERSE_"
    }
    return null
}

function validateSecretValueOrThrow(value: string): void {
    const error = validateSecretValue(value)
    if (error) {
        throw new CliError("invalid_secret_value", error)
    }
}

function validateSecretValue(value: string): string | null {
    if (Buffer.byteLength(value, "utf8") > MAX_SECRET_VALUE_BYTES) {
        return "Secret value must be 32KB or less"
    }
    return null
}
