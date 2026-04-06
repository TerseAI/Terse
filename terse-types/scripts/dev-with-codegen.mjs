#!/usr/bin/env node

import { spawn } from "node:child_process"
import { resolve } from "node:path"
import process from "node:process"
import readline from "node:readline"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const uvCommand = process.platform === "win32" ? "uv.exe" : "uv"
const project = "tsconfig.build.json"
const target = "dist"
const repoRoot = resolve(process.cwd(), "..")

const tsc = spawn(pnpmCommand, ["exec", "tsc", "-p", project, "--watch", "--preserveWatchOutput"], {
    cwd: process.cwd(),
    stdio: ["inherit", "pipe", "pipe"]
})

tsc.stdout.pipe(process.stdout)
tsc.stderr.pipe(process.stderr)

let pipelineRunning = false
let pipelineQueued = false

function runCommand(command, args, cwd = process.cwd()) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            cwd,
            stdio: "inherit"
        })

        child.on("exit", code => {
            if (code === 0) {
                resolvePromise()
                return
            }

            rejectPromise(new Error(`Command failed with exit code ${code ?? "unknown"}: ${command} ${args.join(" ")}`))
        })

        child.on("error", rejectPromise)
    })
}

async function runPipeline() {
    if (pipelineRunning) {
        pipelineQueued = true
        return
    }

    pipelineRunning = true

    try {
        await runCommand(pnpmCommand, [
            "exec",
            "node",
            "--input-type=module",
            "-e",
            `import { fix } from "tsc-esm-fix"; await fix({ cwd: process.cwd(), target: [${JSON.stringify(target)}], ext: ".js" })`
        ])

        await runCommand(pnpmCommand, ["exec", "tsx", "scripts/export-json-schema.ts"])

        await runCommand(uvCommand, ["run", "python", "scripts/generate-pydantic-from-schema.py"], repoRoot)
    } catch (error) {
        console.error("[dev:python-types] Failed to regenerate Python types.", error)
    } finally {
        pipelineRunning = false

        if (pipelineQueued) {
            pipelineQueued = false
            void runPipeline()
        }
    }
}

function watchForSuccessfulBuild(stream) {
    const rl = readline.createInterface({ input: stream })
    rl.on("line", line => {
        if (line.includes("Found 0 errors.")) {
            void runPipeline()
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
