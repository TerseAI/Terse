#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts"
import chalk from "chalk"
import { execSync, spawn } from "node:child_process"
import { exec } from "node:child_process"
import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execAsync = promisify(exec)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.resolve(SCRIPT_DIR, "../templates")
const PACKAGE_JSON_PATH = path.resolve(SCRIPT_DIR, "../package.json")

const DEFAULTS = {
    targetDir: "./terse",
    frontendUrl: "http://localhost:5173",
    backendUrl: "http://localhost:3001"
} as const

type CliArgs = {
    nonInteractive: boolean
    targetDir?: string
    frontendUrl?: string
    backendUrl?: string
    noOpen: boolean
    help: boolean
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
        printHelp()
        return
    }
    const nonInteractive = args.nonInteractive || !process.stdin.isTTY || !process.stdout.isTTY

    intro(chalk.bold(chalk.magenta(" Terse self-host setup ")))
    if (nonInteractive) log.info("Running non-interactively. Pass --target / --frontend-url / --backend-url to override defaults.")

    const targetDir = await promptOr(nonInteractive, args.targetDir, "Where should we set up Terse?", DEFAULTS.targetDir)
    const resolved = path.resolve(targetDir)

    await fs.mkdir(resolved, { recursive: true })
    await fs.copyFile(path.join(TEMPLATES_DIR, "docker-compose.yml"), path.join(resolved, "docker-compose.yml"))
    await fs.copyFile(path.join(TEMPLATES_DIR, "README.md"), path.join(resolved, "README.md"))

    const frontendUrl = await promptOr(nonInteractive, args.frontendUrl, "Frontend URL (as seen from your browser)", DEFAULTS.frontendUrl)
    const backendUrl = await promptOr(nonInteractive, args.backendUrl, "Backend URL (as seen from your browser)", DEFAULTS.backendUrl)

    const postgresPort = await findFreePort(5432)
    if (postgresPort !== 5432) {
        log.warn(`Port 5432 is taken on this machine, exposing the Terse Postgres container on ${postgresPort} instead.`)
    }

    const frontendPort = hostPortFromUrl(frontendUrl)
    const backendPort = hostPortFromUrl(backendUrl)
    const releaseVersion = await readOwnVersion()
    await writeEnv(resolved, { frontendUrl, backendUrl, frontendPort, backendPort, postgresPort, releaseVersion })
    log.success(`Wrote .env (edit ${path.join(targetDir, ".env")} to tweak ports, URLs, or secrets)`)

    await runStepStreaming(`Pulling Terse image ${releaseVersion} (first run downloads ~500MB)`, "docker compose pull", resolved)
    await runStep("Starting Terse services", "docker compose up -d", resolved)
    await waitForBackend(backendUrl)

    await installTerseCli(releaseVersion)
    await pointTerseCliAtLocal({ frontendUrl, backendUrl })

    printNextSteps({ frontendUrl })
    outro(chalk.green(`Setup complete. Terse is running at ${chalk.bold(frontendUrl)}.`))

    if (!nonInteractive && !args.noOpen) {
        await openInBrowser(frontendUrl)
    }
}

async function openInBrowser(url: string): Promise<void> {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
    try {
        await execAsync(`${opener} ${shellEscape(url)}`)
    } catch {
        // browser open is a nice-to-have; if it fails the user already has the URL in the outro
    }
}

function printNextSteps(args: { frontendUrl: string }): void {
    log.message(
        [
            chalk.bold("Next steps:"),
            `  1. Open ${chalk.cyan(args.frontendUrl)} ${chalk.dim("to bootstrap your single admin user.")}`,
            `  2. ${chalk.cyan("terse init my-job")}    ${chalk.dim("# scaffold your first job (CLI is installed and pointed at your local backend).")}`,
            "",
            chalk.dim("See `README.md` in this folder for daily ops (logs, upgrades, backups, troubleshooting)."),
            chalk.dim("Run `terse target` any time to see which backend the CLI is pointing at.")
        ].join("\n")
    )
}

async function installTerseCli(releaseVersion: string): Promise<void> {
    const spec = `terse-cli@${releaseVersion}`
    await runStep(`Installing terse CLI globally (npm i -g ${spec})`, `npm install -g ${spec}`, process.cwd())
}

async function pointTerseCliAtLocal(urls: { frontendUrl: string; backendUrl: string }): Promise<void> {
    if (!commandExists("terse")) {
        log.warn("terse CLI not on PATH, skipping `terse target use`. Run it manually once installed.")
        return
    }
    const cmd = `terse target use --backend-url ${shellEscape(urls.backendUrl)} --frontend-url ${shellEscape(urls.frontendUrl)} --yes`
    await runStep(`Pointing terse CLI at ${urls.backendUrl}`, cmd, process.cwd())
}

function commandExists(name: string): boolean {
    try {
        execSync(`command -v ${name}`, { stdio: "pipe" })
        return true
    } catch {
        return false
    }
}

async function readOwnVersion(): Promise<string> {
    const parsed: unknown = JSON.parse(await fs.readFile(PACKAGE_JSON_PATH, "utf8"))
    if (typeof parsed === "object" && parsed !== null && "version" in parsed && typeof parsed.version === "string") return parsed.version
    throw new Error(`Could not read a version from ${PACKAGE_JSON_PATH}`)
}

async function writeEnv(
    targetDir: string,
    config: { frontendUrl: string; backendUrl: string; frontendPort: number; backendPort: number; postgresPort: number; releaseVersion: string }
): Promise<void> {
    const socketUrl = toWebSocketUrl(config.backendUrl)
    const lines = [
        "# Terse self-host config. Edit values then `docker compose up -d` to apply.",
        "",
        "# ── URLs (what your browser sees) ─────────────────────────────",
        `FRONTEND_URL=${config.frontendUrl}`,
        `BACKEND_URL=${config.backendUrl}`,
        "",
        "# ── Host ports (must match the ports in the URLs above) ───────",
        `FRONTEND_PORT=${config.frontendPort}`,
        `BACKEND_PORT=${config.backendPort}`,
        "",
        "# ── Postgres ──────────────────────────────────────────────────",
        "POSTGRES_USER=postgres",
        "POSTGRES_PASSWORD=postgres",
        "POSTGRES_DB=terse",
        `POSTGRES_PORT=${config.postgresPort}`,
        "",
        "# ── Secrets (rotate by replacing the values) ──────────────────",
        `JWT_SECRET=${randomBytes(32).toString("base64url")}`,
        `LOCAL_SECRETS_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`,
        "",
        "# ── Frontend (must match BACKEND_URL above) ───────────────────",
        `VITE_API_BASE_URL=${config.backendUrl}`,
        `VITE_BACKEND_REDIRECT_URL=${config.backendUrl}`,
        `VITE_SOCKET_URL=${socketUrl}`,
        "",
        "# ── Internal backend URL (how the backend container reaches itself) ─",
        "# Job runs talk to the backend from inside the container, where it",
        "# always listens on 3001. This is NOT the host port in BACKEND_URL.",
        "# Leave as-is unless you change the backend's in-container listen port.",
        "INTERNAL_BACKEND_URL=http://localhost:3001",
        "",
        "# ── Runtime ───────────────────────────────────────────────────",
        "NODE_ENV=development",
        "",
        "# ── Image ─────────────────────────────────────────────────────",
        "# Change the tag to upgrade, or use `latest` to track new releases.",
        `TERSE_IMAGE=us-central1-docker.pkg.dev/fluid-analogy-473415-c2/public/terse:${config.releaseVersion}`,
        ""
    ]
    await fs.writeFile(path.join(targetDir, ".env"), lines.join("\n"))
}

function toWebSocketUrl(httpUrl: string): string {
    const url = new URL(httpUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    return url.toString().replace(/\/$/, "")
}

function hostPortFromUrl(httpUrl: string): number {
    const url = new URL(httpUrl)
    if (url.port) return Number(url.port)
    return url.protocol === "https:" ? 443 : 80
}

async function promptOr(nonInteractive: boolean, override: string | undefined, message: string, placeholder: string): Promise<string> {
    if (override !== undefined) {
        log.info(`${message} ${chalk.dim(`→ ${override}`)}`)
        return override
    }
    if (nonInteractive) {
        log.info(`${message} ${chalk.dim(`→ ${placeholder} (default)`)}`)
        return placeholder
    }
    const result = await text({ message, placeholder, defaultValue: placeholder })
    if (isCancel(result)) {
        cancel("Cancelled.")
        process.exit(0)
    }
    return result as string
}

function parseArgs(argv: string[]): CliArgs {
    const out: CliArgs = { nonInteractive: false, noOpen: false, help: false }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        const next = (): string => {
            const v = argv[++i]
            if (v === undefined) throw new Error(`Missing value for ${arg}`)
            return v
        }
        const valueOf = (flag: string): string => {
            const eq = arg.indexOf("=")
            return eq >= 0 ? arg.slice(eq + 1) : next()
        }
        if (arg === "-y" || arg === "--yes" || arg === "--non-interactive") out.nonInteractive = true
        else if (arg === "-h" || arg === "--help") out.help = true
        else if (arg === "--target" || arg.startsWith("--target=")) out.targetDir = valueOf(arg)
        else if (arg === "--frontend-url" || arg.startsWith("--frontend-url=")) out.frontendUrl = valueOf(arg)
        else if (arg === "--backend-url" || arg.startsWith("--backend-url=")) out.backendUrl = valueOf(arg)
        else if (arg === "--no-open") out.noOpen = true
        else throw new Error(`Unknown argument: ${arg}. Run with --help for usage.`)
    }
    return out
}

function printHelp(): void {
    const lines = [
        chalk.bold("create-terse — scaffold a self-hosted Terse instance"),
        "",
        chalk.bold("Usage:"),
        "  npx create-terse [options]",
        "",
        chalk.bold("Options:"),
        "  -y, --non-interactive       Skip prompts and use defaults (also auto-enabled when stdin/stdout is not a TTY)",
        `  --target <dir>              Target directory (default: ${DEFAULTS.targetDir})`,
        `  --frontend-url <url>        Frontend URL (default: ${DEFAULTS.frontendUrl})`,
        `  --backend-url <url>         Backend URL (default: ${DEFAULTS.backendUrl})`,
        "  --no-open                   Skip opening the frontend in your browser when setup completes",
        "  -h, --help                  Show this help",
        "",
        chalk.bold("Examples:"),
        "  npx create-terse",
        "  npx create-terse -y",
        "  npx create-terse -y --target ./my-terse --backend-url http://localhost:3001"
    ]
    console.log(lines.join("\n"))
}

async function runStep(label: string, command: string, cwd: string): Promise<void> {
    const s = spinner()
    s.start(label)
    try {
        await execAsync(command, { cwd })
        s.stop(`${label} ✓`)
    } catch (err) {
        s.stop(`${label} ✗`)
        const message = err instanceof Error ? err.message : String(err)
        const stdout = (err as { stdout?: string }).stdout ?? ""
        const stderr = (err as { stderr?: string }).stderr ?? ""
        throw new Error([message, stdout, stderr].filter(Boolean).join("\n"))
    }
}

async function runStepStreaming(label: string, command: string, cwd: string): Promise<void> {
    log.info(label)
    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, { cwd, stdio: "inherit", shell: true })
        child.on("exit", code => {
            if (code === 0) {
                log.success(`${label} ✓`)
                resolve()
            } else {
                reject(new Error(`${label} failed with exit code ${code}`))
            }
        })
        child.on("error", reject)
    })
}

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
}

async function findFreePort(preferred: number): Promise<number> {
    const candidates = [preferred, 54322, 54323, 54324, 54325]
    for (const port of candidates) {
        if (await isPortFree(port)) return port
    }
    throw new Error("Could not find a free TCP port for Postgres")
}

async function isPortFree(port: number): Promise<boolean> {
    const v4Busy = await tryConnect("127.0.0.1", port)
    const v6Busy = await tryConnect("::1", port)
    return !v4Busy && !v6Busy
}

function tryConnect(host: string, port: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = net.connect({ host, port })
        const done = (ok: boolean) => {
            socket.removeAllListeners()
            socket.destroy()
            resolve(ok)
        }
        socket.once("connect", () => done(true))
        socket.once("error", () => done(false))
    })
}

async function waitForBackend(backendUrl: string): Promise<void> {
    const s = spinner()
    s.start(`Waiting for backend at ${backendUrl}`)
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
        try {
            const response = await fetch(backendUrl, { signal: AbortSignal.timeout(2000) })
            if (response.status < 500) {
                s.stop(`Backend is responding ✓`)
                return
            }
        } catch {
            // not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    s.stop(`Backend did not become ready in 120s ✗`)
    throw new Error(`Backend at ${backendUrl} never started responding. Check logs with: docker compose logs backend`)
}

main().catch(err => {
    log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
