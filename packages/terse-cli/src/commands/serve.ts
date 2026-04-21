import chalk from "chalk"
import chokidar from "chokidar"
import crypto from "node:crypto"
import http from "node:http"
import { TERSE_SIGNATURE_HEADER, TERSE_SIGNATURE_VERSION, TERSE_TIMESTAMP_HEADER, webhookJobChallengeRequestSchema, webhookJobTriggerRequestSchema } from "terse-types/types"

import { readApiKeyOrBail, readEnvVar } from "../api.js"
import { loadJobRegistry } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function serve(opts: { port: number; cwd?: string; entryFile?: string; verbose?: boolean }, provider?: LanguageProvider): Promise<void> {
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
    let registry = await loadJobRegistry(resolvedProvider, opts.entryFile)

    let reloadTimer: NodeJS.Timeout | undefined
    let reloadInFlight: Promise<void> | undefined

    async function reloadRegistry(reason: string): Promise<void> {
        if (reloadInFlight) {
            return reloadInFlight
        }

        reloadInFlight = (async () => {
            try {
                const nextRegistry = await loadJobRegistry(resolvedProvider, opts.entryFile)
                registry = nextRegistry
                console.log(chalk.blue(`  Reloaded job registry (${reason})`))
                console.log(chalk.dim(`  Loaded ${registry.size} job${registry.size === 1 ? "" : "s"}: ${[...registry.keys()].join(", ")}`))
            } catch (err) {
                console.error(chalk.red(`  Failed to reload job registry (${reason}):`), err)
                console.error(chalk.dim("  Keeping previous registry in memory."))
            } finally {
                reloadInFlight = undefined
            }
        })()

        return reloadInFlight
    }

    function scheduleReload(reason: string): void {
        if (reloadTimer) {
            clearTimeout(reloadTimer)
        }

        reloadTimer = setTimeout(() => {
            void reloadRegistry(reason)
        }, 150)
    }

    const server = http.createServer(async (req, res) => {
        const startMs = Date.now()

        const method = req.method ?? "UNKNOWN"
        const url = req.url ?? "/"

        console.log(chalk.dim(`\n→ ${method} ${url}`))

        if (opts.verbose) {
            const redactedHeaders = { ...req.headers }
            if (redactedHeaders[TERSE_SIGNATURE_HEADER]) {
                redactedHeaders[TERSE_SIGNATURE_HEADER] = "<redacted>"
            }
            console.log(chalk.dim(`  headers: ${JSON.stringify(redactedHeaders)}`))
        }

        function respond(status: number, body: string, reason: string) {
            const elapsed = Date.now() - startMs
            const statusColor = status < 300 ? chalk.green : chalk.red
            console.log(statusColor(`← ${status}  ${reason}  (${elapsed}ms)`))
            res.writeHead(status, { "Content-Type": "application/json" })
            res.end(body)
        }

        if (method !== "POST" || url !== "/webhook/terse/trigger") {
            console.log(chalk.yellow(`  unexpected route: ${method} ${url} (expected POST /webhook/terse/trigger)`))
            respond(404, JSON.stringify({ error: "Not found" }), "Not found")
            return
        }

        let rawBody: string
        try {
            rawBody = await readBody(req)
        } catch (err) {
            console.error(chalk.red(`  failed to read request body: ${err}`))
            respond(400, "", "Body read error")
            return
        }

        if (opts.verbose) {
            console.log(chalk.dim(`  body length: ${rawBody.length} bytes`))
        }

        const sig = req.headers[TERSE_SIGNATURE_HEADER]
        const ts = req.headers[TERSE_TIMESTAMP_HEADER]

        if (typeof sig !== "string" || typeof ts !== "string") {
            const missing = [typeof sig !== "string" && TERSE_SIGNATURE_HEADER, typeof ts !== "string" && TERSE_TIMESTAMP_HEADER].filter(Boolean).join(", ")
            console.error(chalk.red(`  missing headers: ${missing}`))
            respond(401, JSON.stringify({ error: "Invalid signature" }), "Missing headers")
            return
        }

        const timestamp = parseInt(ts, 10)
        const nowMs = Date.now()
        const deltaSeconds = Math.round((nowMs - timestamp * 1000) / 1000)

        if (opts.verbose) {
            console.log(chalk.dim(`  timestamp delta: ${deltaSeconds}s ago`))
        }

        const computed = computeRequestSignature(signingSecret, timestamp, rawBody)
        if (sig !== computed) {
            console.error(chalk.red(`  signature verification failed`))
            console.error(chalk.red(`  secret length : ${signingSecret.length} (expected 64)`))
            console.error(chalk.red(`  received sig  : ${sig}`))
            console.error(chalk.red(`  computed sig  : ${computed}`))
            console.error(chalk.red(`  base string   : ${TERSE_SIGNATURE_VERSION}:${timestamp}:${rawBody.slice(0, 100)}`))
            respond(401, JSON.stringify({ error: "Invalid signature" }), "Invalid signature")
            return
        }

        let payload: unknown
        try {
            payload = JSON.parse(rawBody)
        } catch {
            const preview = rawBody.slice(0, 100)
            console.error(chalk.red(`  invalid JSON — body preview: ${preview}`))
            respond(400, JSON.stringify({ error: "Invalid JSON" }), "Invalid JSON")
            return
        }

        // Challenge handshake — backend sends this before the first real job dispatch
        const challengeResult = webhookJobChallengeRequestSchema.safeParse(payload)
        if (challengeResult.success) {
            const { challenge } = challengeResult.data
            const signature = computeChallengeSignature(signingSecret, challenge)
            console.log(chalk.yellow(`  handshake challenge: ${challenge.slice(0, 8)}…`))
            respond(200, JSON.stringify({ challenge, signature }), "Handshake OK")
            return
        }

        // Job dispatch
        const dispatchResult = webhookJobTriggerRequestSchema.safeParse(payload)
        if (!dispatchResult.success) {
            const issues = dispatchResult.error.format()
            console.error(chalk.red(`  invalid dispatch payload: ${JSON.stringify(issues)}`))
            respond(400, JSON.stringify({ error: "Missing required fields: jobName, runId, event" }), "Invalid payload")
            return
        }

        const { jobName, runId, event } = dispatchResult.data
        const job = registry.get(jobName)

        if (!job) {
            console.error(chalk.red(`  job "${jobName}" not found — available: ${[...registry.keys()].join(", ")}`))
            respond(404, JSON.stringify({ error: `Job "${jobName}" not found` }), `Job not found`)
            return
        }

        // Respond immediately — job executes asynchronously
        respond(200, "{}", `Running job "${jobName}"`)
        console.log(chalk.cyan(`  job: ${jobName}  run: ${runId}`))

        resolvedProvider.executeJob(job, runId, event as any, { entryFile: opts.entryFile }).catch(err => {
            console.error(chalk.red(`  job "${jobName}" failed:`), err)
        })
    })

    // File watcher for hot reloading
    const watchTarget = opts.entryFile ?? process.cwd()

    const watcher = chokidar.watch(watchTarget, {
        ignored: [/(^|[\/\\])\../, /node_modules/, /\.turbo/, /\.next/, /dist/, /build/, /\.cache/],
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 50
        }
    })

    watcher.on("all", (eventName, changedPath) => {
        if (!/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json)$/.test(changedPath)) {
            return
        }

        console.log(chalk.yellow(`  Detected ${eventName}: ${changedPath}`))
        scheduleReload(changedPath)
    })

    watcher.on("error", err => {
        console.error(chalk.red("  File watcher error:"), err)
    })

    console.log(chalk.dim(`  Watching for job file changes in ${watchTarget}`))

    server.listen(opts.port, () => {
        console.log(chalk.green(`\n  terse serve listening on http://localhost:${opts.port}`))
        console.log(chalk.dim(`  Loaded ${registry.size} job${registry.size === 1 ? "" : "s"}: ${[...registry.keys()].join(", ")}`))
        console.log(chalk.dim(`  Point your agent's Remote Server URL to http://localhost:${opts.port}`))
        if (opts.verbose) {
            console.log(chalk.dim(`  Verbose logging enabled`))
        }
        console.log()
    })

    const shutdown = () => {
        if (reloadTimer) {
            clearTimeout(reloadTimer)
            reloadTimer = undefined
        }
        void watcher.close()
        server.close()
    }

    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on("data", chunk => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
        req.on("error", reject)
    })
}

function computeRequestSignature(signingSecret: string, timestamp: number, body: string): string {
    return `${TERSE_SIGNATURE_VERSION}=` + crypto.createHmac("sha256", signingSecret).update(`${TERSE_SIGNATURE_VERSION}:${timestamp}:${body}`).digest("hex")
}

function computeChallengeSignature(signingSecret: string, challengeToken: string): string {
    return crypto.createHmac("sha256", signingSecret).update(challengeToken).digest("hex")
}
