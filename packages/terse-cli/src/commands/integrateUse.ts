import { select } from "@clack/prompts"
import chalk from "chalk"
import type { IntegrationConnection, IntegrationType, TerseProjectConfig } from "terse-types"

import { readApiKeyOrBail } from "../api.js"
import { CliError, ErrorCode } from "../cliError.js"
import { isNonInteractive } from "../cliHelpers.js"
import { fetchIntegrationConnections } from "../integrationApi.js"
import { readProjectConfig, readProjectConfigOrBail, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"

import { generate } from "./generate.js"
import { abortIfCancelled, parseIntegrationTypeOrThrow } from "./integrate.js"

export async function integrateUse(opts: IntegrateUseOpts, provider: LanguageProvider): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const cwd = process.cwd()
    const config = readProjectConfigOrBail(cwd)

    if (opts.clear) {
        clearPin(cwd, config, type)
        await generate(provider)
        return
    }

    const apiKey = readApiKeyOrBail()
    const connections = await fetchIntegrationConnections(apiKey, type)
    if (connections.length === 0) {
        throw new CliError("integration_not_connected", `Integration '${type}' is not connected.`, {
            detail: `Run \`terse integrate connect ${type}\` first.`,
            actionRequired: true
        })
    }

    const connection = await resolveConnection(type, connections, opts.connectionId)
    writeProjectConfig(cwd, { ...config, connections: { ...config.connections, [type]: connection.id } })
    process.stdout.write(`Pinned ${type} → ${describeConnection(connection)}\n`)
    await generate(provider)
}

export async function integrateConnections(opts: IntegrateConnectionsOpts): Promise<void> {
    const type = parseIntegrationTypeOrThrow(opts.integrationType)
    const apiKey = readApiKeyOrBail()
    const connections = await fetchIntegrationConnections(apiKey, type)
    const pinnedId = readProjectConfig()?.connections?.[type]

    if (opts.json) {
        const payload = {
            type,
            connections: connections.map(connection => ({
                id: connection.id,
                name: connection.name,
                pinned: connection.id === pinnedId
            }))
        }
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    if (connections.length === 0) {
        process.stdout.write(`Integration '${type}' has no connections. Run \`terse integrate connect ${type}\` first.\n`)
        return
    }

    for (const connection of connections) {
        const pin = connection.id === pinnedId ? chalk.dim(" (pinned)") : ""
        process.stdout.write(`  ${chalk.cyan(connection.id)}  ${connection.name}${pin}\n`)
    }
}

function clearPin(cwd: string, config: TerseProjectConfig, type: IntegrationType): void {
    if (!config.connections?.[type]) {
        throw new CliError("no_pinned_connection", `No pinned connection for '${type}' in this project.`)
    }

    const remaining = { ...config.connections }
    delete remaining[type]
    writeProjectConfig(cwd, { ...config, connections: Object.keys(remaining).length > 0 ? remaining : undefined })
    process.stdout.write(`Cleared the pinned ${type} connection\n`)
}

async function resolveConnection(type: IntegrationType, connections: IntegrationConnection[], requestedId: string | undefined): Promise<IntegrationConnection> {
    if (requestedId) {
        const match = connections.find(connection => connection.id === requestedId)
        if (!match) {
            throw new CliError("unknown_connection", `No '${type}' connection with ID '${requestedId}'.`, {
                detail: `Connections: ${connections.map(describeConnection).join(", ")}`
            })
        }
        return match
    }

    if (connections.length === 1) {
        return connections[0]
    }

    if (isNonInteractive()) {
        throw new CliError("connection_id_required", `Integration '${type}' has ${connections.length} connections; pass a connection ID when running non-interactively.`, {
            detail: `List them with \`terse integrate connections ${type} --json\`, then run \`terse integrate use ${type} <connection-id>\`. Connections: ${connections.map(describeConnection).join(", ")}`,
            exitCode: ErrorCode.BAD_ARGUMENTS
        })
    }

    const picked = abortIfCancelled(
        await select({
            message: `Select the ${type} connection for this project`,
            options: connections.map(connection => ({ value: connection.id, label: describeConnection(connection) }))
        })
    )
    const match = connections.find(connection => connection.id === picked)
    if (!match) {
        throw new CliError("unknown_connection", `Connection '${String(picked)}' is no longer available.`)
    }
    return match
}

function describeConnection(connection: IntegrationConnection): string {
    return connection.name === connection.id ? connection.id : `${connection.name} (${connection.id})`
}

export type IntegrateUseOpts = {
    integrationType: string
    connectionId?: string
    clear?: boolean
}

export type IntegrateConnectionsOpts = {
    integrationType: string
    json?: boolean
}
