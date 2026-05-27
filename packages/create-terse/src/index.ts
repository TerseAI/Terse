#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts"
import chalk from "chalk"
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

    const frontendUrl = await prompt("Frontend URL", "http://localhost:5173")
    const backendUrl = await prompt("Backend URL", "http://localhost:3001")

    const postgresPort = await findFreePort(5432)
    if (postgresPort !== 5432) {
        log.warn(`Port 5432 is taken on this machine, using ${postgresPort} for the Terse Postgres container instead.`)
    }

    await writeComposeEnv(resolved, postgresPort)
    await writeEnv(resolved, { frontendUrl, backendUrl, postgresPort })
    log.success(`Wrote backend/.env (Postgres on localhost:${postgresPort}) with generated JWT + Fernet secrets`)
    await writeFrontendEnv(resolved, { backendUrl })
    log.success(`Wrote frontend/.env pointing at ${backendUrl}`)

    await runStep("Installing dependencies", "pnpm install", resolved)
    await runStep("Starting Postgres container", "docker compose up -d --wait postgres", resolved)
    await waitForPostgres(resolved)
    await verifyHostCanReachPostgres(postgresPort)
    await runStep("Generating Prisma clients", "pnpm --filter backend run db:generate", resolved)
    await runStep("Migrating main database", "pnpm --filter backend exec prisma migrate deploy", resolved)
    await runStep("Migrating local SQLite", "pnpm --filter backend exec prisma migrate deploy --schema=./prisma/local/schema.prisma", resolved)

    outro(chalk.green(`Done. Next: ${chalk.bold(`cd ${targetDir} && pnpm dev`)}`))
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

async function writeEnv(targetDir: string, config: { frontendUrl: string; backendUrl: string; postgresPort: number }): Promise<void> {
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

async function verifyHostCanReachPostgres(port: number): Promise<void> {
    const s = spinner()
    s.start(`Verifying host can reach Postgres on localhost:${port}`)
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
        if (await tryConnect("127.0.0.1", port)) {
            s.stop(`Host can reach localhost:${port} ✓`)
            return
        }
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    s.stop(`Host cannot reach localhost:${port} ✗`)
    throw new Error(`Postgres container is up but the host cannot reach localhost:${port}. ` + `Another process may be holding the port, or Docker's port mapping failed.`)
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

async function waitForPostgres(cwd: string): Promise<void> {
    const s = spinner()
    s.start("Waiting for Postgres to accept connections")
    const deadline = Date.now() + 60_000
    let lastError: unknown
    while (Date.now() < deadline) {
        try {
            await execAsync(`docker compose exec -T postgres psql -U postgres -d terse -c "SELECT 1" -v ON_ERROR_STOP=1`, { cwd })
            s.stop("Postgres is ready ✓")
            return
        } catch (err) {
            lastError = err
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }
    s.stop("Postgres did not become ready ✗")
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`Timed out waiting for Postgres after 60s.\n${message}`)
}

main().catch(err => {
    log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
