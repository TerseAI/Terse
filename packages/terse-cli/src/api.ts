import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"

import { BACKEND_URL } from "./config.js"

export function readApiKey(): string | null {
    const envPath = path.resolve(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return null
    const content = fs.readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue
        const [key, ...rest] = trimmed.split("=")
        if (key.trim() === "TERSE_API_KEY") {
            const val = rest.join("=").trim()
            if (val) {
                process.env.TERSE_API_KEY = val
            }
            return val || null
        }
    }
    return null
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
