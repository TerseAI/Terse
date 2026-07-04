#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDir = path.resolve(__dirname, "..")
const envFile = path.join(backendDir, ".env")
const backendPort = 3001
const ngrokApiUrl = "http://127.0.0.1:4040/api/tunnels"
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

dotenv.config({ path: envFile })

const args = new Set(process.argv.slice(2))
const forceTunnel = args.has("--tunnel")
const helpRequested = args.has("--help") || args.has("-h")

if (helpRequested) {
    console.log("Usage: pnpm run dev")
    console.log("")
    console.log("Starts the backend dev server.")
    console.log("If NGROK_DOMAIN or DEV_TUNNEL is set, also starts an ngrok tunnel and updates BACKEND_URL.")
    console.log("")
    console.log("Tunnel env vars:")
    console.log("  DEV_TUNNEL=1            Force ngrok tunnel startup")
    console.log("  NGROK_DOMAIN=...        Use a reserved ngrok domain and enable tunnel mode")
    console.log("  NGROK_AUTH_TOKEN=...    Optional auth token used to configure ngrok")
    process.exit(0)
}

const isTruthy = value => value != null && !["", "0", "false", "no", "off"].includes(value.toLowerCase())

const shouldStartTunnel = forceTunnel || isTruthy(process.env.DEV_TUNNEL) || Boolean(process.env.NGROK_DOMAIN)

let shuttingDown = false
let serverProcess = null
let tunnelProcess = null
let workerProcess = null

function runPnpm(args, options = {}) {
    return spawn(pnpmCommand, args, {
        cwd: backendDir,
        stdio: "inherit",
        env: process.env,
        ...options
    })
}

function waitForExit(child) {
    return new Promise((resolve, reject) => {
        child.on("exit", code => resolve(code ?? 0))
        child.on("error", reject)
    })
}

function updateEnvVar(name, value) {
    let content = ""
    if (fs.existsSync(envFile)) {
        content = fs.readFileSync(envFile, "utf8")
    }

    const line = `${name}=${value}`
    if (new RegExp(`^${name}=`, "m").test(content)) {
        content = content.replace(new RegExp(`^${name}=.*$`, "m"), line)
    } else {
        content = content.trimEnd()
        content = content ? `${content}\n${line}\n` : `${line}\n`
    }

    fs.writeFileSync(envFile, content)
}

function checkNgrokInstalled() {
    const result = spawnSync("ngrok", ["version"], { stdio: "ignore" })
    if (result.status === 0) {
        return
    }

    console.error("ngrok is not installed. Install it with `brew install ngrok` or disable tunnel mode.")
    process.exit(1)
}

function configureNgrokAuth() {
    const authToken = process.env.NGROK_AUTH_TOKEN
    if (!authToken) {
        console.warn("NGROK_AUTH_TOKEN is not set. ngrok will use anonymous mode and may rotate URLs.")
        return
    }

    spawnSync("ngrok", ["config", "add-authtoken", authToken], { stdio: "ignore" })
}

function stopExistingNgrok() {
    if (process.platform === "win32") {
        return
    }

    spawnSync("pkill", ["-f", `ngrok.*${backendPort}`], { stdio: "ignore" })
}

async function waitForTunnelUrl() {
    const desiredAddrs = new Set([
        String(backendPort),
        `localhost:${backendPort}`,
        `127.0.0.1:${backendPort}`,
        `http://localhost:${backendPort}`,
        `http://127.0.0.1:${backendPort}`
    ])

    for (let attempt = 0; attempt < 15; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))

        try {
            const response = await fetch(ngrokApiUrl)
            if (!response.ok) {
                continue
            }

            const body = await response.json()
            const tunnels = Array.isArray(body.tunnels) ? body.tunnels : []
            const matchingTunnel = tunnels.find(tunnel => desiredAddrs.has(String(tunnel?.config?.addr)))

            if (matchingTunnel?.public_url) {
                return matchingTunnel.public_url
            }
        } catch {
            // Retry until the API is ready.
        }
    }

    return null
}

async function startTunnel() {
    checkNgrokInstalled()
    configureNgrokAuth()
    stopExistingNgrok()

    const tunnelArgs = ["http", String(backendPort), "--log=stdout"]
    if (process.env.NGROK_DOMAIN) {
        tunnelArgs.push(`--domain=${process.env.NGROK_DOMAIN}`)
    }

    tunnelProcess = spawn("ngrok", tunnelArgs, {
        cwd: backendDir,
        stdio: "inherit",
        env: process.env
    })

    tunnelProcess.on("exit", code => {
        if (shuttingDown) {
            return
        }

        console.error(`ngrok exited unexpectedly with code ${code ?? "unknown"}.`)
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill("SIGTERM")
        }
        process.exit(code ?? 1)
    })

    const url = await waitForTunnelUrl()
    if (!url) {
        console.error("Failed to determine ngrok public URL from the local API.")
        process.exit(1)
    }

    updateEnvVar("BACKEND_URL", url)
    process.env.BACKEND_URL = url

    console.log(`ngrok tunnel ready: ${url}`)
    console.log(`Slack events URL: ${url}/slack/events`)
}

function startServer() {
    serverProcess = runPnpm(["run", "dev:server"], { env: process.env })

    serverProcess.on("exit", code => {
        if (!shuttingDown && tunnelProcess && !tunnelProcess.killed) {
            tunnelProcess.kill("SIGTERM")
        }
        if (!shuttingDown && workerProcess && !workerProcess.killed) {
            workerProcess.kill("SIGTERM")
        }

        process.exit(code ?? 0)
    })
}

function startWorker() {
    workerProcess = runPnpm(["run", "dev:worker"], { env: process.env })

    workerProcess.on("exit", code => {
        if (shuttingDown) {
            return
        }
        console.error(`Queue worker exited unexpectedly with code ${code ?? "unknown"}.`)
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill("SIGTERM")
        }
        process.exit(code ?? 1)
    })
}

function shutdown(signal) {
    shuttingDown = true

    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill(signal)
    }

    if (tunnelProcess && !tunnelProcess.killed) {
        tunnelProcess.kill(signal)
    }

    if (workerProcess && !workerProcess.killed) {
        workerProcess.kill(signal)
    }
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

if (shouldStartTunnel) {
    await startTunnel()
}

startServer()
startWorker()
