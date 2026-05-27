#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts"
import chalk from "chalk"
import { execSync, spawn } from "node:child_process"
import { exec } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execAsync = promisify(exec)

const REPO_URL = "https://github.com/TerseAI/Terse.git"
const DEFAULT_INSTALL_BRANCH = "main"
const INSTALL_BRANCH = process.env.TERSE_INSTALL_BRANCH?.trim() || DEFAULT_INSTALL_BRANCH
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.resolve(SCRIPT_DIR, "../templates")

async function main(): Promise<void> {
    intro(chalk.bold(chalk.magenta(" Terse self-host setup ")))

    const targetDir = await prompt("Where should we set up Terse?", "./terse")
    const resolved = path.resolve(targetDir)

    await cloneIfMissing(resolved)

    await fs.copyFile(path.join(TEMPLATES_DIR, "docker-compose.yml"), path.join(resolved, "docker-compose.yml"))

    const frontendUrl = await prompt("Frontend URL (as seen from your browser)", "http://localhost:5173")
    const backendUrl = await prompt("Backend URL (as seen from your browser)", "http://localhost:3001")

    const postgresPort = await findFreePort(5432)
    if (postgresPort !== 5432) {
        log.warn(`Port 5432 is taken on this machine, exposing the Terse Postgres container on ${postgresPort} instead.`)
    }

    await writeComposeEnv(resolved, postgresPort)
    await writeBackendEnv(resolved, { frontendUrl, backendUrl, postgresPort })
    log.success("Wrote backend/.env with generated JWT + Fernet secrets")
    await writeFrontendEnv(resolved, { backendUrl })
    log.success(`Wrote frontend/.env pointing at ${backendUrl}`)

    await runStepStreaming("Building Terse Docker image (first run takes a few minutes)", "docker compose build", resolved)
    await runStep("Starting Terse services", "docker compose up -d", resolved)
    await waitForBackend(backendUrl)

    await installTerseCli()
    await pointTerseCliAtLocal({ frontendUrl, backendUrl })

    printNextSteps({ frontendUrl })
    outro(chalk.green(`Setup complete. Terse is running at ${chalk.bold(frontendUrl)}.`))
}

function printNextSteps(args: { frontendUrl: string }): void {
    log.message(
        [
            chalk.bold("Next steps:"),
            `  1. Open ${chalk.cyan(args.frontendUrl)} ${chalk.dim("to bootstrap your single admin user.")}`,
            `  2. ${chalk.cyan("terse init my-job")}    ${chalk.dim("# scaffold your first job (CLI is installed and pointed at your local backend).")}`,
            "",
            chalk.dim("Run `terse target` any time to see which backend the CLI is pointing at.")
        ].join("\n")
    )
}

async function installTerseCli(): Promise<void> {
    if (commandExists("terse")) {
        log.info("terse CLI already installed, skipping global install")
        return
    }
    await runStep("Installing terse CLI globally (npm i -g terse-cli)", "npm install -g terse-cli", process.cwd())
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

async function cloneIfMissing(targetDir: string): Promise<void> {
    if (existsSync(path.join(targetDir, "backend/prisma/schema.prisma"))) {
        log.info("Existing Terse checkout detected, skipping clone")
        return
    }
    const s = spinner()
    s.start(`Cloning Terse (${INSTALL_BRANCH}) → ${targetDir}`)
    try {
        await execAsync(`git clone --depth=1 --branch ${shellEscape(INSTALL_BRANCH)} ${REPO_URL} ${shellEscape(targetDir)}`)
        s.stop(`Cloned into ${targetDir}`)
    } catch (err) {
        s.stop("Clone failed")
        throw err
    }
}

async function writeBackendEnv(targetDir: string, config: { frontendUrl: string; backendUrl: string; postgresPort: number }): Promise<void> {
    // DATABASE_URL and LOCAL_DB_URL are overridden by docker-compose for the
    // in-container case. The values below are only used if a developer runs
    // backend commands directly on the host.
    const localDbPath = path.join(targetDir, "backend/prisma/local/local.db")
    const lines = [
        `DATABASE_URL=postgres://postgres:postgres@localhost:${config.postgresPort}/terse`,
        `LOCAL_DB_URL=file:${localDbPath}`,
        `JWT_SECRET=${randomBytes(32).toString("base64url")}`,
        `LOCAL_SECRETS_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`,
        `FRONTEND_URL=${config.frontendUrl}`,
        `BACKEND_URL=${config.backendUrl}`,
        `NODE_ENV=development`,
        ""
    ]
    await fs.writeFile(path.join(targetDir, "backend/.env"), lines.join("\n"))
}

async function writeComposeEnv(targetDir: string, postgresPort: number): Promise<void> {
    await fs.writeFile(path.join(targetDir, ".env"), `POSTGRES_PORT=${postgresPort}\n`)
}

async function writeFrontendEnv(targetDir: string, config: { backendUrl: string }): Promise<void> {
    const socketUrl = toWebSocketUrl(config.backendUrl)
    const lines = [`VITE_API_BASE_URL=${config.backendUrl}`, `VITE_BACKEND_REDIRECT_URL=${config.backendUrl}`, `VITE_SOCKET_URL=${socketUrl}`, ""]
    await fs.writeFile(path.join(targetDir, "frontend/.env"), lines.join("\n"))
}

function toWebSocketUrl(httpUrl: string): string {
    const url = new URL(httpUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    return url.toString().replace(/\/$/, "")
}

async function prompt(message: string, placeholder: string): Promise<string> {
    const result = await text({ message, placeholder, defaultValue: placeholder })
    if (isCancel(result)) {
        cancel("Cancelled.")
        process.exit(0)
    }
    return result as string
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
