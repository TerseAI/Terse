import { cancel, isCancel, password } from "@clack/prompts"
import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import dotenv from "dotenv"
import fs from "node:fs"
import { ApiRoutes, MAX_SECRET_VALUE_BYTES, buildRoute, validateSecretName, validateSecretValue } from "terse-types"
import type { ProjectSecretSummary, ProjectSecretUpsertRequest, ProjectSecretsImportResponse, ProjectSecretsListResponse } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { mirrorSecretToLocalEnv, removeSecretFromLocalEnv } from "../envMirror.js"
import { readProjectConfigOrBail } from "../projectConfig.js"

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

export async function secretsAdd(name: string, opts: { valueStdin?: boolean; skipLocalSync?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    validateSecretNameOrThrow(name)

    const value = opts.valueStdin ? await readValueFromStdin() : await promptForSecretValue(name)
    validateSecretValueOrThrow(value)

    const body: ProjectSecretUpsertRequest = { name, value }
    await fetchWithAuth<ProjectSecretSummary>(buildRoute(ApiRoutes.PROJECT_SECRETS.UPSERT, { id: config.projectId }), apiKey, body, "POST")

    process.stdout.write(chalk.green(`Secret ${name} saved.\n`))
    if (!opts.skipLocalSync) {
        mirrorSecretToLocalEnv(name, value)
    }
}

export async function secretsRemove(name: string, opts: { yes?: boolean; skipLocalSync?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    validateSecretNameOrThrow(name)

    const existing = await fetchWithAuth<ProjectSecretsListResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.LIST, { id: config.projectId }), apiKey)
    if (!existing.secrets.some(secret => secret.name === name)) {
        throw new CliError("secret_not_found", `Secret ${name} not found in project ${config.name}.`)
    }

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

    try {
        await fetchWithAuth<ProjectSecretSummary>(buildRoute(ApiRoutes.PROJECT_SECRETS.DELETE, { id: config.projectId, name }), apiKey, {}, "DELETE")
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            throw new CliError("secret_not_found", `Secret ${name} not found in project ${config.name}.`)
        }
        throw error
    }

    process.stdout.write(chalk.green(`Secret ${name} removed.\n`))
    if (!opts.skipLocalSync) {
        removeSecretFromLocalEnv(name)
    }
}

export async function secretsImport(filePath: string, opts: { overwrite?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    assertManagedProjectConfig(config)
    let entries = parseEnvFile(readTextFile(filePath))
    const skipped: string[] = []

    if (!opts.overwrite && entries.length > 0) {
        const existing = await fetchWithAuth<ProjectSecretsListResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.LIST, { id: config.projectId }), apiKey)
        const existingNames = new Set(existing.secrets.map(secret => secret.name))
        entries = entries.filter(entry => {
            if (!existingNames.has(entry.name)) return true
            skipped.push(entry.name)
            return false
        })
    }

    let response: ProjectSecretsImportResponse = { added: [], updated: [] }
    if (entries.length > 0) {
        response = await fetchWithAuth<ProjectSecretsImportResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.IMPORT, { id: config.projectId }), apiKey, { entries }, "POST")
    }

    const accepted = [...response.added, ...response.updated]
    process.stdout.write(chalk.green(`Imported ${accepted.length} secret${accepted.length === 1 ? "" : "s"}.\n`))
    if (skipped.length > 0) {
        process.stdout.write(chalk.yellow(`Skipped ${skipped.length} existing entr${skipped.length === 1 ? "y" : "ies"} (pass --overwrite to update):\n`))
        for (const name of skipped) {
            process.stdout.write(`  ${name}\n`)
        }
    }
}

export function parseEnvFile(raw: string): ProjectSecretUpsertRequest[] {
    const entries: ProjectSecretUpsertRequest[] = []
    const parsed = dotenv.parse(raw)

    for (const [index, line] of raw.split(/\r?\n/).entries()) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue

        const separatorIndex = line.indexOf("=")
        if (separatorIndex <= 0) {
            throw new CliError("invalid_env_file", `Line ${index + 1}: expected KEY=VALUE.`)
        }

        const name = line.slice(0, separatorIndex).trim()
        const nameError = validateSecretName(name)
        if (nameError) {
            throw new CliError("invalid_secret_name", `${name}: ${nameError}`)
        }

        const value = parsed[name] ?? ""
        const valueError = validateSecretValue(value)
        if (valueError) {
            throw new CliError("invalid_secret_value", `${name}: ${valueError}`)
        }

        entries.push({ name, value })
    }

    return entries
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

function validateSecretValueOrThrow(value: string): void {
    const error = validateSecretValue(value)
    if (error) {
        throw new CliError("invalid_secret_value", error)
    }
}
