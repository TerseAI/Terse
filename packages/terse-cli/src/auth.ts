import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import chalk from "chalk"
import { confirm } from "@inquirer/prompts"
import ora from "ora"
import { fetchWithAuth, readApiKey } from "./api.js"
import { BACKEND_URL, WORKOS_CLIENT_ID } from "./config.js"
import type { DeviceTokenExchangeResponse } from "terse-types"

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

function openInBrowser(url: string): void {
    const platform = process.platform
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open"
    exec(`${cmd} "${url}"`)
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

        const data = await res.json() as { error?: string }

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
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        throw new Error(`${res.status} — ${body.error || "Failed to exchange token"}`)
    }

    return res.json() as Promise<DeviceTokenExchangeResponse>
}

/**
 * Run the full device authorization login flow.
 * Returns the API key on success, or null if the user cancels.
 */
export async function login(): Promise<{ apiKey: string; displayName: string | null } | null> {
    const spinner = ora("Requesting login code").start()

    let deviceData: DeviceCodeResponse
    try {
        deviceData = await requestDeviceCode()
        spinner.stop()
    } catch (err: any) {
        spinner.fail("Failed to start login flow")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    console.log(`\n  ${chalk.bold("To sign in, open this URL in your browser:")}\n`)
    console.log(`  ${chalk.cyan(deviceData.verification_uri_complete)}\n`)
    console.log(`  Or visit ${chalk.cyan(deviceData.verification_uri)} and enter code: ${chalk.bold(deviceData.user_code)}\n`)

    openInBrowser(deviceData.verification_uri_complete)

    const pollSpinner = ora("Waiting for authentication in browser").start()

    let tokenData: TokenResponse
    try {
        tokenData = await pollForTokens(deviceData.device_code, deviceData.expires_in, deviceData.interval)
        pollSpinner.text = "Exchanging token"
    } catch (err: any) {
        pollSpinner.fail("Login failed")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    let exchangeData: DeviceTokenExchangeResponse
    try {
        exchangeData = await exchangeForApiKey(tokenData.access_token)
        pollSpinner.succeed(`Logged in as ${chalk.bold(exchangeData.user.displayName || exchangeData.user.email)}`)
    } catch (err: any) {
        pollSpinner.fail("Failed to create API key")
        console.error(chalk.red(`  ${err.message}`))
        return null
    }

    return { apiKey: exchangeData.apiKey, displayName: exchangeData.user.displayName }
}

/**
 * Run login and write the API key to .env in the given directory.
 * If a valid key already exists, prompts the user to confirm before re-authenticating.
 */
export async function loginAndWriteEnv(targetDir: string): Promise<boolean> {
    const existingKey = readApiKey()
    if (existingKey) {
        const spinner = ora("Checking existing API key").start()
        try {
            const me = await fetchWithAuth<{ displayName?: string | null; firstName?: string | null; email?: string | null }>("/sdk/me", existingKey)
            const name = me.displayName || me.firstName || me.email || "Unknown user"
            spinner.succeed(`Already logged in as ${chalk.bold(name)}`)
            const shouldContinue = await confirm({ message: "Log in again with a different account?", default: false })
            if (!shouldContinue) return true
        } catch {
            spinner.warn("Existing API key is invalid or expired")
        }
    }

    const result = await login()
    const apiKey = result?.apiKey ?? ""

    const envPath = path.resolve(targetDir, ".env")
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : ""

    if (envContent.includes("TERSE_API_KEY=")) {
        const updated = envContent.replace(/^TERSE_API_KEY=.*$/m, `TERSE_API_KEY=${apiKey}`)
        fs.writeFileSync(envPath, updated)
    } else {
        fs.writeFileSync(envPath, envContent ? `${envContent.trimEnd()}\nTERSE_API_KEY=${apiKey}\n` : `TERSE_API_KEY=${apiKey}\n`)
    }

    if (!result) {
        console.log(chalk.dim("  You can run `terse login` later to authenticate."))
    }

    return true
}
