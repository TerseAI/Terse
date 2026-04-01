import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export const UV_INSTALL_DOCS_URL = "https://docs.astral.sh/uv/getting-started/installation/"

export function shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`
}

export function loadDotenv(cwd: string): NodeJS.ProcessEnv {
    const env = { ...process.env }
    const envPath = path.join(cwd, ".env")
    if (!fs.existsSync(envPath)) return env

    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue

        const separatorIndex = trimmed.indexOf("=")
        if (separatorIndex === -1) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        let value = trimmed.slice(separatorIndex + 1).trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }

        env[key] = value
    }

    return env
}

export async function ensureUvAvailable(cwd: string): Promise<void> {
    try {
        await execFileAsync("uv", ["--version"], { cwd })
    } catch (error) {
        if (isMissingExecutableError(error)) {
            throw new Error(`Python projects require uv. Install: ${UV_INSTALL_DOCS_URL}`)
        }
        throw error
    }
}

export async function execUv(
    args: string[],
    opts: {
        cwd: string
        env?: NodeJS.ProcessEnv
    }
): Promise<{ stdout: string; stderr: string }> {
    await ensureUvAvailable(opts.cwd)

    return execFileAsync("uv", args, {
        cwd: opts.cwd,
        env: opts.env,
        maxBuffer: 20 * 1024 * 1024,
    })
}

export async function withTempScript<T>(
    source: string,
    extension: string,
    fn: (scriptPath: string) => Promise<T>
): Promise<T> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "terse-cli-"))
    const scriptPath = path.join(tempDir, `script${extension}`)

    try {
        await fs.promises.writeFile(scriptPath, source, "utf-8")
        return await fn(scriptPath)
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
}

function isMissingExecutableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    const code = (error as NodeJS.ErrnoException).code
    return code === "ENOENT" || code === "ENOTDIR"
}
