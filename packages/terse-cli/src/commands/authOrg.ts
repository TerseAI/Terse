import { select } from "@inquirer/prompts"
import chalk from "chalk"
import type { SdkOrganizationsListResponse, SwitchOrganizationResponse } from "terse-types"

import { ApiError, fetchWithAuth, readApiKey } from "../api.js"
import { isNonInteractive } from "../cliHelpers.js"
import { cacheOrgToken, getStoredApiKeyForOrg, setActiveOrg, setActiveOrgToken } from "../userConfig.js"

/**
 * Get an API key scoped to `orgId`, reusing a cached one if we have it and
 * otherwise minting a fresh one via `/sdk/auth/switch-organization`. Does NOT
 * change the user's active org — callers that want to flip active should use
 * `setActiveOrgToken` directly.
 */
export async function resolveApiKeyForOrg(orgId: string, orgName: string, currentApiKey: string): Promise<string> {
    const cached = getStoredApiKeyForOrg(orgId)
    if (cached) return cached
    const minted = await fetchWithAuth<SwitchOrganizationResponse>("/sdk/auth/switch-organization", currentApiKey, { organizationId: orgId }, "POST")
    cacheOrgToken(minted.organization.id, minted.apiKey, orgName)
    return minted.apiKey
}

function readApiKeyOrExit(): string {
    const apiKey = readApiKey()
    if (!apiKey) {
        console.log("Not logged in. Run `terse auth login`.")
        process.exit(1)
    }
    return apiKey
}

async function loadOrganizations(apiKey: string): Promise<SdkOrganizationsListResponse> {
    try {
        return await fetchWithAuth<SdkOrganizationsListResponse>("/sdk/me/organizations", apiKey)
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
            console.log("Credentials expired. Run `terse auth login`.")
            process.exit(1)
        }
        throw err
    }
}

export async function authOrgList(opts: { json?: boolean }): Promise<void> {
    const apiKey = readApiKeyOrExit()
    const data = await loadOrganizations(apiKey)

    if (opts.json) {
        process.stdout.write(JSON.stringify(data, null, 2) + "\n")
        return
    }

    if (data.organizations.length === 0) {
        console.log("No organizations.")
        return
    }

    for (const org of data.organizations) {
        const active = org.id === data.activeOrganizationId
        const marker = active ? chalk.green("*") : " "
        console.log(`${marker} ${org.name} ${chalk.dim(org.id)}`)
    }
}

export async function authOrgSwitch(orgIdArg: string | undefined): Promise<void> {
    const apiKey = readApiKeyOrExit()
    const data = await loadOrganizations(apiKey)

    if (data.organizations.length === 0) {
        console.log("No organizations.")
        process.exit(1)
    }
    if (data.organizations.length === 1) {
        console.log("Only one organization, nothing to switch to.")
        return
    }

    let targetId: string
    if (orgIdArg) {
        const match = data.organizations.find(o => o.id === orgIdArg)
        if (!match) {
            console.error(`Unknown organization id "${orgIdArg}". Valid ids:`)
            for (const o of data.organizations) console.error(`  ${o.id}  ${chalk.dim(o.name)}`)
            process.exit(1)
        }
        if (match.id === data.activeOrganizationId) {
            console.log(`Already on ${match.name}.`)
            return
        }
        targetId = match.id
    } else {
        if (isNonInteractive()) {
            console.error("Org id required in non-interactive mode. Pass it as an argument: `terse auth org switch <org-id>`.")
            process.exit(1)
        }
        targetId = await select({
            message: "Switch to which organization?",
            choices: data.organizations.map(o => {
                const isCurrent = o.id === data.activeOrganizationId
                return {
                    name: isCurrent ? o.name : `${o.name} ${chalk.dim(o.id)}`,
                    value: o.id,
                    disabled: isCurrent ? chalk.dim("(current)") : false
                }
            })
        })
    }

    const targetOrg = data.organizations.find(o => o.id === targetId)!

    if (getStoredApiKeyForOrg(targetId)) {
        setActiveOrg(targetId)
        console.log(`Switched to ${targetOrg.name}.`)
        return
    }

    let response: SwitchOrganizationResponse
    try {
        response = await fetchWithAuth<SwitchOrganizationResponse>("/sdk/auth/switch-organization", apiKey, { organizationId: targetId }, "POST")
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
            console.log("Credentials expired. Run `terse auth login`.")
            process.exit(1)
        }
        throw err
    }

    setActiveOrgToken(response.organization.id, response.apiKey, response.organization.name)
    console.log(`Switched to ${response.organization.name}.`)
}
