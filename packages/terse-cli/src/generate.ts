import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"
import ora from "ora"

import { generateCode, type GitHubInstanceData } from "./codegen.js"
import type { GithubIntegration } from "./shared/Integrations.js"
import { IntegrationType } from "./shared/Integrations.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"

const BACKEND_URL = "http://localhost:3001"

export async function generate(): Promise<void> {
    // 1. Read API key
    const apiKey = readApiKey()
    if (!apiKey) {
        console.error(
            chalk.red("\n  Missing TERSE_API_KEY in .env\n") +
            chalk.dim("  Create a project with `terse init` or add TERSE_API_KEY to your .env file.\n")
        )
        process.exit(1)
    }

    // 2. Fetch active integrations
    const spinner = ora("Fetching integrations...").start()

    let activeTypes: IntegrationType[]
    try {
        activeTypes = await fetchWithAuth<IntegrationType[]>(ApiRoutes.INTEGRATIONS.ACTIVE, apiKey)
    } catch (error: any) {
        spinner.fail("Failed to fetch integrations")
        if (error.message?.includes("401")) {
            console.error(chalk.red("\n  Invalid API key. Check your TERSE_API_KEY in .env\n"))
        } else {
            console.error(chalk.red(`\n  ${error.message}\n`))
        }
        process.exit(1)
    }

    if (!activeTypes.includes(IntegrationType.GITHUB)) {
        spinner.succeed("No GitHub integration found")
        const code = generateCode([])
        writeOutput(code)
        console.log(chalk.dim("\n  Connect GitHub in the Terse dashboard, then re-run `terse generate`.\n"))
        return
    }

    // 3. Fetch GitHub instances + repositories
    spinner.text = "Fetching GitHub repositories..."

    let instanceData: GitHubInstanceData[]
    try {
        const instances = await fetchWithAuth<GithubIntegration[]>(ApiRoutes.GITHUB.INTEGRATIONS, apiKey)

        instanceData = await Promise.all(
            instances.map(async (inst) => {
                try {
                    const data = await fetchWithAuth<{
                        repositories: Array<{ id: number; name: string; owner: string }>
                    }>(
                        `${ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION}?installation_id=${encodeURIComponent(inst.installation_id)}`,
                        apiKey
                    )
                    return { integration: inst, repositories: data.repositories || [] }
                } catch {
                    return { integration: inst, repositories: [] }
                }
            })
        )
    } catch (error: any) {
        spinner.fail("Failed to fetch GitHub integrations")
        console.error(chalk.red(`\n  ${error.message}\n`))
        process.exit(1)
    }

    spinner.succeed(`Fetched ${instanceData.length} GitHub integration(s)`)

    // 4. Generate code
    const code = generateCode(instanceData)
    writeOutput(code)

    // 5. Summary
    console.log("")
    for (const inst of instanceData) {
        const name = inst.integration.account_name || inst.integration.id
        const repoCount = inst.repositories.length
        console.log(`  ${chalk.green("+")} ${name} — ${repoCount} ${repoCount === 1 ? "repository" : "repositories"}`)
    }
    console.log(`\n  ${chalk.green.bold("Generated")} src/terse.generated.ts\n`)
}

function writeOutput(code: string): void {
    const srcDir = path.resolve(process.cwd(), "src")
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true })
    }
    const outPath = path.join(srcDir, "terse.generated.ts")
    fs.writeFileSync(outPath, code)
}

// ── Helpers ──

async function fetchWithAuth<T>(urlPath: string, apiKey: string): Promise<T> {
    let res: Response
    try {
        res = await fetch(`${BACKEND_URL}${urlPath}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
        })
    } catch (err: any) {
        throw new Error(`Could not connect to ${BACKEND_URL} — is the backend running?\n  ${err.message}`)
    }

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
        throw new Error(
            `Expected JSON from ${urlPath} but got ${contentType || "unknown content-type"} (HTTP ${res.status}).\n` +
            `  Is the Terse backend running on ${BACKEND_URL}?`
        )
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        throw new Error(`${res.status} ${res.statusText} — ${urlPath}\n  ${body.error || JSON.stringify(body)}`)
    }

    return res.json() as Promise<T>
}

function readApiKey(): string | null {
    const envPath = path.resolve(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return null
    const content = fs.readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue
        const [key, ...rest] = trimmed.split("=")
        if (key.trim() === "TERSE_API_KEY") {
            const val = rest.join("=").trim()
            return val || null
        }
    }
    return null
}
