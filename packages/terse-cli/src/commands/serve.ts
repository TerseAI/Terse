import chalk from "chalk"
import crypto from "node:crypto"
import http from "node:http"
import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER } from "terse-types/types"

import { readApiKeyOrBail, readEnvVar } from "../api.js"
import { loadJobRegistry } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function serve(opts: { port: number; cwd?: string; entryFile?: string }, provider?: LanguageProvider): Promise<void> {
    if (opts.cwd) {
        process.chdir(opts.cwd)
    }

    const signingSecret = readEnvVar("TERSE_SIGNING_SECRET")
    if (!signingSecret) {
        console.error(chalk.red("Error: TERSE_SIGNING_SECRET is not set."))
        console.error(chalk.dim("Set TERSE_SIGNING_SECRET in your .env file or environment."))
        console.error(chalk.dim("Find the signing secret in the Terse dashboard under your agent's settings."))
        process.exit(1)
    }

    readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const resolvedProvider = provider ?? resolveProvider()
    const registry = await loadJobRegistry(resolvedProvider, opts.entryFile)

    const server = http.createServer(async (req, res) => {
        if (req.method !== "POST" || req.url !== "/webhook/terse/trigger") {
            res.writeHead(404, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Not found" }))
            return
        }

        let rawBody: string
        try {
            rawBody = await readBody(req)
        } catch {
            res.writeHead(400)
            res.end()
            return
        }

        const sig = req.headers[TERSE_SIGNATURE_HEADER]
        const ts = req.headers[TERSE_TIMESTAMP_HEADER]

        if (typeof sig !== "string" || typeof ts !== "string" || !verifyRequestSignature(signingSecret, sig, parseInt(ts, 10), rawBody)) {
            res.writeHead(401, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Invalid signature" }))
            return
        }

        let payload: unknown
        try {
            payload = JSON.parse(rawBody)
        } catch {
            res.writeHead(400, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Invalid JSON" }))
            return
        }

        // Challenge handshake — backend sends this before the first real job dispatch
        if (isChallengePayload(payload)) {
            const signature = computeChallengeSignature(signingSecret, payload.challenge)
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ challenge: payload.challenge, signature }))
            console.log(chalk.dim("  Handshake challenge completed."))
            return
        }

        // Job dispatch
        if (!isJobDispatchPayload(payload)) {
            res.writeHead(400, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: "Missing required fields: jobName, runId, event" }))
            return
        }

        const { jobName, runId, event } = payload
        const job = registry.get(jobName)

        if (!job) {
            console.error(chalk.red(`  Job "${jobName}" not found. Available: ${[...registry.keys()].join(", ")}`))
            res.writeHead(404, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: `Job "${jobName}" not found` }))
            return
        }

        // Respond immediately — job executes asynchronously
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end("{}")

        console.log(chalk.cyan(`\n  Running job "${jobName}" (run: ${runId})`))

        resolvedProvider.executeJob(job, runId, event as any, { entryFile: opts.entryFile }).catch(err => {
            console.error(chalk.red(`  Job "${jobName}" failed:`), err)
        })
    })

    server.listen(opts.port, () => {
        console.log(chalk.green(`\n  terse serve listening on http://localhost:${opts.port}`))
        console.log(chalk.dim(`  Loaded ${registry.size} job${registry.size === 1 ? "" : "s"}: ${[...registry.keys()].join(", ")}`))
        console.log(chalk.dim(`  Point your agent's Remote Server URL to http://localhost:${opts.port}\n`))
    })
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on("data", chunk => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
        req.on("error", reject)
    })
}

function verifyRequestSignature(signingSecret: string, signature: string, timestamp: number, body: string): boolean {
    const expected = `${TERSE_SIGNATURE_VERSION}=` + crypto.createHmac("sha256", signingSecret).update(`${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`).digest("hex")
    if (signature.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

function computeChallengeSignature(signingSecret: string, challengeToken: string): string {
    return crypto.createHmac("sha256", signingSecret).update(challengeToken).digest("hex")
}

function isChallengePayload(payload: unknown): payload is { type: "challenge"; challenge: string } {
    return typeof payload === "object" && payload !== null && "type" in payload && (payload as any).type === "challenge" && typeof (payload as any).challenge === "string"
}

function isJobDispatchPayload(payload: unknown): payload is { jobName: string; runId: string; event: unknown } {
    return typeof payload === "object" && payload !== null && typeof (payload as any).jobName === "string" && typeof (payload as any).runId === "string" && "event" in (payload as any)
}
