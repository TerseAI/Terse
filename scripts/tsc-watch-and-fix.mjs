#!/usr/bin/env node

import { spawn } from "node:child_process"
import readline from "node:readline"
import process from "node:process"

const args = process.argv.slice(2)
const project = args[0] ?? "tsconfig.json"
const target = args[1] ?? "dist"
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

const tsc = spawn(pnpmCommand, ["exec", "tsc", "-p", project, "--watch", "--preserveWatchOutput"], {
    cwd: process.cwd(),
    stdio: ["inherit", "pipe", "pipe"]
})

tsc.stdout.pipe(process.stdout)
tsc.stderr.pipe(process.stderr)

let fixRunning = false
let fixQueued = false

function runCommand(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(pnpmCommand, args, {
            cwd: process.cwd(),
            stdio: "inherit"
        })

        child.on("exit", code => {
            if (code === 0) {
                resolve()
                return
            }

            reject(new Error(`Command failed with exit code ${code ?? "unknown"}`))
        })

        child.on("error", reject)
    })
}

async function applyFixes() {
    if (fixRunning) {
        fixQueued = true
        return
    }

    fixRunning = true

    try {
        await runCommand([
            "exec",
            "node",
            "--input-type=module",
            "-e",
            `import { fix } from "tsc-esm-fix"; await fix({ cwd: process.cwd(), target: [${JSON.stringify(target)}], ext: ".js" })`
        ])
    } catch (error) {
        console.error("[tsc-watch-and-fix] Failed to update ESM import extensions.", error)
    } finally {
        fixRunning = false

        if (fixQueued) {
            fixQueued = false
            void applyFixes()
        }
    }
}

function watchForSuccessfulBuild(stream) {
    const rl = readline.createInterface({ input: stream })
    rl.on("line", line => {
        if (line.includes("Found 0 errors.")) {
            void applyFixes()
        }
    })
}

watchForSuccessfulBuild(tsc.stdout)
watchForSuccessfulBuild(tsc.stderr)

function shutdown(signal) {
    if (!tsc.killed) {
        tsc.kill(signal)
    }
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

tsc.on("exit", code => {
    process.exit(code ?? 0)
})
