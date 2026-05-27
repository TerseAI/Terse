#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts"
import chalk from "chalk"
import { execSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REPO_URL = "https://github.com/TerseAI/Terse.git"
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

    await writeEnv(resolved, { frontendUrl, backendUrl })
    log.success("Wrote backend/.env with generated JWT + Fernet secrets")

    await runStep("Installing dependencies", "pnpm install", resolved)
    await runStep("Starting Postgres container", "docker compose up -d --wait postgres", resolved)
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
    s.start(`Cloning Terse → ${targetDir}`)
    try {
        execSync(`git clone --depth=1 ${REPO_URL} ${shellEscape(targetDir)}`, { stdio: "pipe" })
        s.stop(`Cloned into ${targetDir}`)
    } catch (err) {
        s.stop("Clone failed")
        throw err
    }
}

async function writeEnv(targetDir: string, urls: { frontendUrl: string; backendUrl: string }): Promise<void> {
    const lines = [
        `DATABASE_URL=postgres://postgres:postgres@localhost:5432/terse`,
        `LOCAL_DB_URL=file:./local.db`,
        `JWT_SECRET=${randomBytes(32).toString("base64url")}`,
        `LOCAL_SECRETS_ENCRYPTION_KEY=${randomBytes(32).toString("base64url")}`,
        `FRONTEND_URL=${urls.frontendUrl}`,
        `BACKEND_URL=${urls.backendUrl}`,
        `NODE_ENV=development`,
        ""
    ]
    await fs.writeFile(path.join(targetDir, "backend/.env"), lines.join("\n"))
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
        execSync(command, { cwd, stdio: "pipe" })
        s.stop(`${label} ✓`)
    } catch (err) {
        s.stop(`${label} ✗`)
        const message = err instanceof Error ? err.message : String(err)
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? ""
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? ""
        throw new Error([message, stdout, stderr].filter(Boolean).join("\n"))
    }
}

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
}

main().catch(err => {
    log.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
