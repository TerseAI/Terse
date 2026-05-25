import { log } from "@clack/prompts"
import { select } from "@inquirer/prompts"
import chalk from "chalk"
import type { DeviceTokenExchangeResponse, IdentifyResponse, UserSession } from "terse-types"

import { fetchWithAuth, readApiKeyFromDir } from "../api.js"
import { CliError, ErrorCode } from "../cliError.js"
import { type NonInteractiveOpts } from "../cliHelpers.js"
import { createSpinner } from "../cliUi.js"
import { BACKEND_URL, FRONTEND_URL, WORKOS_CLIENT_ID } from "../config.js"
import { openUrlInBrowser } from "../openBrowser.js"
import { clearStoredApiKey, getAuthFilePath, getStoredApiKey, setActiveOrgToken } from "../userConfig.js"

const DEVICE_AUTH_URL = "https://api.workos.com/user_management/authorize/device"
const TOKEN_URL = "https://api.workos.com/user_management/authenticate"
const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code"
const ORG_CREATE_PATH = "/app/organizations/create"
const IDENTIFY_POLL_INTERVAL_MS = 3000

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await fetch(DEVICE_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: WORKOS_CLIENT_ID })
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Failed to request device code: ${res.status} ${body}`)
    }

    return res.json() as Promise<DeviceCodeResponse>
}

async function pollForTokens(deviceCode: string, expiresIn: number, interval: number): Promise<TokenResponse> {
    const deadline = Date.now() + expiresIn * 1000
    let pollInterval = interval

    while (Date.now() < deadline) {
        await sleep(pollInterval * 1000)

        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: DEVICE_CODE_GRANT_TYPE,
                device_code: deviceCode,
                client_id: WORKOS_CLIENT_ID
            })
        })

        if (res.ok) {
            return res.json() as Promise<TokenResponse>
        }

        const data = (await res.json()) as { error?: string }

        switch (data.error) {
            case "authorization_pending":
                break
            case "slow_down":
                pollInterval += 1
                break
            case "access_denied":
                throw new Error("Authorization was denied")
            case "expired_token":
                throw new Error("Authorization expired — please try again")
            default:
                throw new Error(`Authorization failed: ${data.error}`)
        }
    }

    throw new Error("Authorization timed out — please try again")
}

class JwtRejectedError extends Error {
    constructor() {
        super("WorkOS session expired")
    }
}

async function identifyWithJwt(accessToken: string): Promise<IdentifyResponse> {
    const res = await fetch(`${BACKEND_URL}/sdk/auth/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
    })
    if (res.status === 401) {
        throw new JwtRejectedError()
    }
    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`${res.status} — ${body.error || "Failed to identify"}`)
    }
    return res.json() as Promise<IdentifyResponse>
}

async function waitForOrganizationCreation(accessToken: string, deadline: number): Promise<IdentifyResponse> {
    while (Date.now() < deadline) {
        await sleep(IDENTIFY_POLL_INTERVAL_MS)
        const result = await identifyWithJwt(accessToken)
        if (result.organizations.length > 0) return result
    }
    throw new Error("Timed out waiting for organization creation. Run `terse auth login` again once your organization is set up.")
}

async function exchangeForApiKey(accessToken: string, organizationId: string): Promise<DeviceTokenExchangeResponse> {
    const res = await fetch(`${BACKEND_URL}/sdk/auth/device-token-exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, organizationId })
    })

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`${res.status} — ${body.error || "Failed to exchange token"}`)
    }

    return res.json() as Promise<DeviceTokenExchangeResponse>
}

async function pickOrganization(orgs: IdentifyResponse["organizations"]): Promise<string> {
    if (orgs.length === 1) return orgs[0].id
    return select({
        message: "Select an organization for this CLI session",
        choices: orgs.map(o => ({ name: `${o.name}  ${chalk.dim(o.id)}`, value: o.id }))
    })
}

async function login(): Promise<{ apiKey: string; displayName: string | null; organizationId: string; organizationName: string } | null> {
    const s = createSpinner()
    s.start("Requesting login code")

    let deviceData: DeviceCodeResponse
    try {
        deviceData = await requestDeviceCode()
        s.stop("Login code ready")
    } catch (err: any) {
        s.stop("Failed to start login flow")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    log.info(`Open ${chalk.cyan(deviceData.verification_uri_complete)} in your browser`)
    log.info(`Or visit ${chalk.cyan(deviceData.verification_uri)} and enter code ${chalk.bold(deviceData.user_code)}`)
    openUrlInBrowser(deviceData.verification_uri_complete)

    s.start("Waiting for authentication in browser")

    let tokenData: TokenResponse
    try {
        tokenData = await pollForTokens(deviceData.device_code, deviceData.expires_in, deviceData.interval)
    } catch (err: any) {
        s.stop("Login failed")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    const jwtDeadline = Date.now() + 5 * 60 * 1000

    s.message("Loading your organizations")
    let identity: IdentifyResponse
    try {
        identity = await identifyWithJwt(tokenData.access_token)
    } catch (err: any) {
        s.stop("Login failed")
        if (err instanceof JwtRejectedError) {
            console.error(chalk.red("  WorkOS session expired before we could load your account. Run `terse auth login` again."))
        } else {
            console.error(chalk.red(`  ${err.message}`))
        }
        return null
    }

    if (identity.organizations.length === 0) {
        s.stop("Account ready — finish setup in your browser")
        const orgCreateUrl = `${FRONTEND_URL}${ORG_CREATE_PATH}`
        openUrlInBrowser(orgCreateUrl)
        log.info("Finish creating your organization in the browser. If the tab didn't open, visit:")
        log.info(`  ${chalk.cyan(orgCreateUrl)}`)
        s.start("Waiting for organization creation")
        try {
            identity = await waitForOrganizationCreation(tokenData.access_token, jwtDeadline)
        } catch (err: any) {
            s.stop("Login failed")
            if (err instanceof JwtRejectedError) {
                console.error(chalk.red("  WorkOS session expired before your organization was ready. Run `terse auth login` again."))
            } else {
                console.error(chalk.red(`  ${err.message}`))
            }
            return null
        }
    }

    let organizationId: string
    try {
        s.stop("Organizations loaded")
        organizationId = await pickOrganization(identity.organizations)
        s.start("Issuing API key")
    } catch (err: any) {
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    try {
        const exchangeData = await exchangeForApiKey(tokenData.access_token, organizationId)
        s.stop(`Logged in as ${exchangeData.user.displayName || exchangeData.user.email} · ${exchangeData.organization.name}`)
        return {
            apiKey: exchangeData.apiKey,
            displayName: exchangeData.user.displayName,
            organizationId: exchangeData.organization.id,
            organizationName: exchangeData.organization.name
        }
    } catch (err: any) {
        s.stop("Failed to create API key")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }
}

export async function loginAndPersist(opts?: NonInteractiveOpts): Promise<{ apiKey: string; displayName: string | null } | null> {
    const canFallToDeviceLogin = !opts?.nonInteractive

    const stored = getStoredApiKey()

    if (stored) {
        const s = createSpinner()
        s.start("Checking existing API key")
        const me = await fetchMeForKey(stored)
        if (me) {
            const orgLabel = me.organization?.name ?? "(no organization)"
            s.stop(`Already logged in as ${me.displayName} · ${orgLabel}`)
            return { apiKey: stored, displayName: me.displayName }
        } else {
            s.stop("Existing API key is invalid or expired")
            if (!canFallToDeviceLogin) {
                throw new CliError("not_authenticated", "Stored credentials are invalid or expired.", {
                    detail: 'Run "terse auth login" to refresh them.',
                    actionRequired: true,
                    exitCode: ErrorCode.BAD_ARGUMENTS
                })
            }
        }
    } else if (!canFallToDeviceLogin) {
        throw new CliError("not_authenticated", "Not authenticated.", {
            detail: 'Run "terse auth login" first, then retry.',
            actionRequired: true,
            exitCode: ErrorCode.BAD_ARGUMENTS
        })
    }

    const result = await login()
    if (!result?.apiKey) {
        log.info("You can run `terse auth login` later to authenticate.")
        return null
    }

    setActiveOrgToken(result.organizationId, result.apiKey, result.organizationName)
    log.info(chalk.dim(`Saved credentials to ${getAuthFilePath()}`))

    return { apiKey: result.apiKey, displayName: result.displayName }
}

export function logout(): boolean {
    return clearStoredApiKey()
}

type MeSummary = {
    displayName: string
    organization: { id: string; name: string } | null
}

async function fetchMeForKey(apiKey: string): Promise<MeSummary | null> {
    try {
        const me = await fetchWithAuth<UserSession>("/sdk/me", apiKey)
        return {
            displayName: me.displayName || me.firstName || me.email || "Unknown user",
            organization: me.organizationId ? { id: me.organizationId, name: me.organizationName } : null
        }
    } catch {
        return null
    }
}

export async function getProjectAttachedUserName(targetDir: string): Promise<string | null> {
    const projectKey = readApiKeyFromDir(targetDir)
    if (!projectKey) return null
    const me = await fetchMeForKey(projectKey)
    return me?.displayName ?? null
}

// Types

interface DeviceCodeResponse {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete: string
    interval: number
    expires_in: number
}

interface TokenResponse {
    user: {
        id: string
        email: string
        first_name: string | null
        last_name: string | null
    }
    access_token: string
    refresh_token: string
}
