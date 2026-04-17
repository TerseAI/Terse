import chalk from "chalk"
import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"

import { BACKEND_URL } from "./config.js"

let dotenvLoadedFor: string | null = null

function ensureDotenvLoaded(cwd: string = process.cwd()): void {
    if (dotenvLoadedFor === cwd) return
    const envPath = path.resolve(cwd, ".env")
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, quiet: true })
    }
    dotenvLoadedFor = cwd
}

export function readEnvVar(name: string): string | null {
    ensureDotenvLoaded()
    return process.env[name] || null
}

export function readEnvVarFromDir(dir: string, name: string): string | null {
    const envPath = path.resolve(dir, ".env")
    if (!fs.existsSync(envPath)) return null
    const parsed = dotenv.parse(fs.readFileSync(envPath))
    return parsed[name] || null
}

export function readApiKey(): string | null {
    return readEnvVar("TERSE_API_KEY")
}

export function readApiKeyFromDir(dir: string): string | null {
    return readEnvVarFromDir(dir, "TERSE_API_KEY")
}

export function readApiKeyOrBail(options?: { title?: string; detail?: string }): string {
    const apiKey = readApiKey()
    if (apiKey) return apiKey

    console.error(options?.title ? chalk.red(options.title) : chalk.red("\n  Not authenticated. Run `terse login` first.\n"))

    if (options?.detail) {
        console.error(chalk.dim(options.detail))
    }

    process.exit(1)
}

export function readRunId(): string | null {
    return readEnvVar("TERSE_RUN_ID")
}

export async function fetchWithAuth<T>(urlPath: string, apiKey: string, params: Record<string, unknown> = {}, type: "GET" | "POST" = "GET"): Promise<T> {
    let res: Response
    try {
        res = await fetch(`${BACKEND_URL}${urlPath}`, {
            method: type,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: type === "POST" ? JSON.stringify(params) : undefined
        })
    } catch (err: any) {
        throw new Error(`Could not connect to ${BACKEND_URL} — is the backend running?\n  ${err.message}`)
    }

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
        throw new Error(`Expected JSON from ${urlPath} but got ${contentType || "unknown content-type"} (HTTP ${res.status}).\n` + `  Is the Terse backend running on ${BACKEND_URL}?`)
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`${res.status} ${res.statusText} — ${urlPath}\n  ${body.error || JSON.stringify(body)}`)
    }

    return res.json() as Promise<T>
}
