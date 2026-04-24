import { log } from "@clack/prompts"
import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import type { DeviceTokenExchangeResponse } from "terse-types"

import { fetchWithAuth, readApiKeyFromDir } from "../api.js"
import { CliError } from "../cliError.js"
import { createSpinner } from "../cliUi.js"
import { BACKEND_URL, WORKOS_CLIENT_ID } from "../config.js"
import { type NonInteractiveOpts, isNonInteractive } from "../nonInteractive.js"
import { openUrlInBrowser } from "../openBrowser.js"
import { clearStoredApiKey, getAuthFilePath, getStoredApiKey, setStoredApiKey } from "../userConfig.js"

const DEVICE_AUTH_URL = "https://api.workos.com/user_management/authorize/device"
const TOKEN_URL = "https://api.workos.com/user_management/authenticate"
const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code"

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

async function exchangeForApiKey(accessToken: string): Promise<DeviceTokenExchangeResponse> {
    const res = await fetch(`${BACKEND_URL}/sdk/auth/device-token-exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
    })

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`${res.status} — ${body.error || "Failed to exchange token"}`)
    }

    return res.json() as Promise<DeviceTokenExchangeResponse>
}

export async function login(): Promise<{ apiKey: string; displayName: string | null } | null> {
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
        s.message("Exchanging token")
    } catch (err: any) {
        s.stop("Login failed")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    try {
        const exchangeData = await exchangeForApiKey(tokenData.access_token)
        s.stop(`Logged in as ${exchangeData.user.displayName || exchangeData.user.email}`)
        return { apiKey: exchangeData.apiKey, displayName: exchangeData.user.displayName }
    } catch (err: any) {
        s.stop("Failed to create API key")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }
}

export async function loginAndPersist(opts?: NonInteractiveOpts): Promise<{ apiKey: string; displayName: string | null } | null> {
    const nonInteractive = isNonInteractive(opts)
    const stored = getStoredApiKey()

    if (stored) {
        const s = createSpinner()
        s.start("Checking existing API key")
        const existingName = await fetchDisplayNameForKey(stored)
        if (existingName) {
            s.stop(`Already logged in as ${existingName}`)
            if (nonInteractive) return { apiKey: stored, displayName: existingName }
            const shouldContinue = await confirm({ message: "Log in again with a different account?", default: false })
            if (!shouldContinue) return { apiKey: stored, displayName: existingName }
        } else {
            s.stop("Existing API key is invalid or expired")
            if (nonInteractive) {
                throw new CliError("not_authenticated", "Stored credentials are invalid or expired.", {
                    detail: 'Run "terse login" to refresh them.',
                    actionRequired: true,
                    exitCode: 2
                })
            }
        }
    } else if (nonInteractive) {
        throw new CliError("not_authenticated", "Not authenticated.", {
            detail: 'Run "terse login" first, then retry.',
            actionRequired: true,
            exitCode: 2
        })
    }

    const result = await login()
    if (!result?.apiKey) {
        log.info("You can run `terse login` later to authenticate.")
        return null
    }

    setStoredApiKey(result.apiKey)
    log.info(chalk.dim(`Saved credentials to ${getAuthFilePath()}`))

    return result
}

export async function getExistingAuthenticatedUserName(): Promise<string | null> {
    const stored = getStoredApiKey()
    if (!stored) return null
    return fetchDisplayNameForKey(stored)
}

export function logout(): boolean {
    return clearStoredApiKey()
}

async function fetchDisplayNameForKey(apiKey: string): Promise<string | null> {
    try {
        const me = await fetchWithAuth<{ displayName?: string | null; firstName?: string | null; email?: string | null }>("/sdk/me", apiKey)
        return me.displayName || me.firstName || me.email || "Unknown user"
    } catch {
        return null
    }
}

export async function getProjectAttachedUserName(targetDir: string): Promise<string | null> {
    const projectKey = readApiKeyFromDir(targetDir)
    if (!projectKey) return null
    return fetchDisplayNameForKey(projectKey)
}
