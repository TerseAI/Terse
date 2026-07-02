/**
 * Idempotent provisioning of the queue/worker infrastructure on Render for one environment.
 *
 * The queue migration makes REDIS_URL mandatory (settings.ts) and adds a second entry point
 * (worker.ts) that consumes the pg-boss queues (durable state lives in Postgres via DATABASE_URL;
 * Redis carries only ephemeral pub/sub, Socket.IO adapter, and rate-limit keys). This script wires
 * both for a target environment so prod can be set up the same way Staging was set up by hand. It
 * is the infra counterpart to migrateFromCloudSchedulerToPgBoss.ts (run that to retire the old GCP crons
 * once this is live).
 *
 * It does three things, each a no-op if already in the desired state:
 *   1. Ensure a Render Key Value (Valkey) named <redis-name> exists with maxmemoryPolicy=noeviction
 *      and internal-only access. (Since the job queue moved to Postgres, noeviction is merely
 *      conservative — everything in Redis is TTL'd, so this could relax to allkeys-lru later.)
 *   2. Ensure REDIS_URL on the base web service points at that instance's internal URL.
 *   3. Ensure a background worker (<worker-name>) exists, mirroring the web service's build/runtime,
 *      running `pnpm run start:worker`, with the web service's env vars copied over (REDIS_URL set to
 *      the Key Value), PR previews on, and auto-deploy on — so it deploys with every staging/prod push.
 *
 * Everything is derived from the base web service you point it at (--web-service), so region, plan,
 * build command, owner, branch, and environment all come from there. The worker tracks the same
 * branch as the web service (normally `main`).
 *
 * SAFETY: dry-run is the DEFAULT. Nothing is mutated unless you pass --apply.
 *   pnpm tsx src/scripts/setupRenderQueueInfra.ts --web-service srv-xxxx              # dry run
 *   pnpm tsx src/scripts/setupRenderQueueInfra.ts --web-service srv-xxxx --apply      # apply
 *
 * Requires RENDER_API_KEY in the environment (same key CI uses).
 */
import "dotenv/config"
import { z } from "zod"

const RENDER_API_BASE = "https://api.render.com/v1"
const WORKER_START_COMMAND = "cd backend && pnpm run start:worker"
const REQUIRED_MAXMEMORY_POLICY = "noeviction"
const DEFAULT_MAX_SHUTDOWN_DELAY_SECONDS = 120
const DEFAULT_REDIS_PLAN = "starter"

async function main(): Promise<void> {
    const apiKey = parseEnv()
    const args = parseArgs(process.argv.slice(2))
    const render = new RenderClient(apiKey)

    const web = await render.getService(args.webServiceId)
    if (web.type !== "web_service") throw new SetupError(`--web-service ${args.webServiceId} is a ${web.type}, expected web_service`)

    const redisName = args.redisName ?? `${web.name.toLowerCase()}-redis`
    const workerName = args.workerName ?? `${web.name.toLowerCase()}-worker`
    const banner = args.apply ? "APPLY (mutating)" : "DRY RUN (no changes)"
    console.log(`\n=== Render queue infra setup — base=${web.name} (${web.environmentId}) — ${banner} ===\n`)

    const redisUrl = await ensureKeyValue(render, web, redisName, args)
    await ensureWebRedisUrl(render, web, redisUrl, args)
    await ensureWorker(render, web, workerName, redisUrl, args)

    console.log(`\nDone.${args.apply ? "" : " (dry run) Re-run with --apply to perform these changes."}`)
}

// ── Step 1: Key Value (Valkey) ────────────────────────────────────────────────

/** Ensure the Valkey instance exists with noeviction; returns its internal URL (null in dry-run when it must still be created). */
async function ensureKeyValue(render: RenderClient, web: Service, redisName: string, args: Args): Promise<string | null> {
    const existing = await render.findKeyValue(web.ownerId, redisName, web.environmentId)

    if (existing) {
        const policy = existing.options?.maxmemoryPolicy ?? "unknown"
        console.log(`• Key Value "${redisName}" exists (${existing.id}, status=${existing.status}, maxmemoryPolicy=${policy})`)
        if (policy !== REQUIRED_MAXMEMORY_POLICY) {
            if (args.apply) {
                await render.setKeyValueMaxmemoryPolicy(existing.id, REQUIRED_MAXMEMORY_POLICY)
                console.log(`  ✓ set maxmemoryPolicy=${REQUIRED_MAXMEMORY_POLICY}`)
            } else {
                console.log(`  [dry-run] would set maxmemoryPolicy=${REQUIRED_MAXMEMORY_POLICY} (currently ${policy})`)
            }
        }
        return (await render.getKeyValueConnection(existing.id)).internalConnectionString
    }

    if (!args.apply) {
        console.log(
            `• [dry-run] would create Key Value "${redisName}" (Valkey, plan=${args.redisPlan}, region=${web.serviceDetails.region}, maxmemoryPolicy=${REQUIRED_MAXMEMORY_POLICY}, internal-only)`
        )
        return null
    }

    const created = await render.createKeyValue({
        name: redisName,
        ownerId: web.ownerId,
        environmentId: web.environmentId,
        plan: args.redisPlan,
        region: web.serviceDetails.region,
        maxmemoryPolicy: REQUIRED_MAXMEMORY_POLICY,
        ipAllowList: []
    })
    console.log(`• ✓ created Key Value "${redisName}" (${created.id})`)
    await render.waitForKeyValueAvailable(created.id)
    await render.setKeyValueMaxmemoryPolicy(created.id, REQUIRED_MAXMEMORY_POLICY)
    const url = (await render.getKeyValueConnection(created.id)).internalConnectionString
    console.log(`  ✓ available, maxmemoryPolicy=${REQUIRED_MAXMEMORY_POLICY}`)
    return url
}

// ── Step 2: REDIS_URL on the web service ──────────────────────────────────────

async function ensureWebRedisUrl(render: RenderClient, web: Service, redisUrl: string | null, args: Args): Promise<void> {
    const vars = await render.listEnvVars(web.id)
    const current = vars.find(v => v.key === "REDIS_URL")?.value ?? null

    if (redisUrl && current === redisUrl) {
        console.log(`• REDIS_URL on ${web.name} already correct`)
        return
    }
    if (!args.apply) {
        console.log(`• [dry-run] would set REDIS_URL on ${web.name} to ${redisUrl ?? "the new Key Value's internal URL"}`)
        return
    }
    if (!redisUrl) throw new SetupError("internal Redis URL unavailable; cannot set REDIS_URL")
    await render.upsertEnvVar(web.id, "REDIS_URL", redisUrl)
    console.log(`• ✓ set REDIS_URL on ${web.name}`)
}

// ── Step 3: background worker ─────────────────────────────────────────────────

async function ensureWorker(render: RenderClient, web: Service, workerName: string, redisUrl: string | null, args: Args): Promise<void> {
    const existing = await render.findWorker(web.ownerId, workerName, web.environmentId)

    if (existing) {
        console.log(`• Worker "${workerName}" exists (${existing.id})`)
        await reconcileExistingWorker(render, existing, redisUrl, args)
        return
    }

    if (!args.apply) {
        console.log(
            `• [dry-run] would create worker "${workerName}" (branch=${web.branch}, start="${WORKER_START_COMMAND}", previews=automatic, autoDeploy=yes, maxShutdownDelay=${args.maxShutdownDelaySeconds}s)`
        )
        console.log(`  [dry-run] would copy env vars from ${web.name} and set REDIS_URL`)
        return
    }
    if (!redisUrl) throw new SetupError("internal Redis URL unavailable; cannot create worker")

    const envVars = await buildWorkerEnvVars(render, web.id, redisUrl)
    const created = await render.createWorker({
        name: workerName,
        ownerId: web.ownerId,
        repo: web.repo,
        branch: web.branch,
        rootDir: web.rootDir,
        environmentId: web.environmentId,
        runtime: web.serviceDetails.runtime,
        plan: web.serviceDetails.plan,
        region: web.serviceDetails.region,
        buildCommand: web.serviceDetails.envSpecificDetails.buildCommand,
        startCommand: WORKER_START_COMMAND,
        maxShutdownDelaySeconds: args.maxShutdownDelaySeconds,
        envVars
    })
    console.log(`• ✓ created worker "${workerName}" (${created.id}) with ${envVars.length} env vars`)
}

async function reconcileExistingWorker(render: RenderClient, worker: Service, redisUrl: string | null, args: Args): Promise<void> {
    const needsBranchOrPreview = worker.serviceDetails.previews?.generation !== "automatic" || worker.autoDeploy !== "yes"
    if (needsBranchOrPreview) {
        if (args.apply) {
            await render.patchService(worker.id, { autoDeploy: "yes", serviceDetails: { previews: { generation: "automatic" } } })
            console.log(`  ✓ ensured previews=automatic, autoDeploy=yes`)
        } else {
            console.log(`  [dry-run] would ensure previews=automatic, autoDeploy=yes`)
        }
    }

    const vars = await render.listEnvVars(worker.id)
    const current = vars.find(v => v.key === "REDIS_URL")?.value ?? null
    if (redisUrl && current !== redisUrl) {
        if (args.apply) {
            await render.upsertEnvVar(worker.id, "REDIS_URL", redisUrl)
            console.log(`  ✓ set REDIS_URL`)
        } else {
            console.log(`  [dry-run] would set REDIS_URL`)
        }
    }
}

/** All of the web service's env vars (non-null), with REDIS_URL pinned to the Key Value's internal URL. */
async function buildWorkerEnvVars(render: RenderClient, webServiceId: string, redisUrl: string): Promise<EnvVarInput[]> {
    const copied = (await render.listEnvVars(webServiceId)).filter(v => v.value !== null).map(v => ({ key: v.key, value: v.value as string }))
    const withoutRedis = copied.filter(v => v.key !== "REDIS_URL")
    return [...withoutRedis, { key: "REDIS_URL", value: redisUrl }]
}

// ── Render API client ─────────────────────────────────────────────────────────

class RenderClient {
    constructor(private readonly apiKey: string) {}

    async getService(id: string): Promise<Service> {
        return serviceSchema.parse(await this.request("GET", `/services/${id}`))
    }

    async patchService(id: string, patch: ServicePatch): Promise<void> {
        await this.request("PATCH", `/services/${id}`, patch)
    }

    async findWorker(ownerId: string, name: string, environmentId: string): Promise<Service | null> {
        const items = serviceListSchema.parse(await this.request("GET", `/services?ownerId=${ownerId}&type=background_worker&limit=100`))
        return items.map(i => i.service).find(s => s.name === name && s.environmentId === environmentId) ?? null
    }

    async createWorker(input: CreateWorkerInput): Promise<Service> {
        const body = {
            type: "background_worker",
            name: input.name,
            ownerId: input.ownerId,
            repo: input.repo,
            branch: input.branch,
            autoDeploy: "yes",
            rootDir: input.rootDir,
            environmentId: input.environmentId,
            serviceDetails: {
                runtime: input.runtime,
                plan: input.plan,
                region: input.region,
                maxShutdownDelaySeconds: input.maxShutdownDelaySeconds,
                previews: { generation: "automatic" },
                envSpecificDetails: { buildCommand: input.buildCommand, startCommand: input.startCommand }
            },
            envVars: input.envVars
        }
        const created = await this.request("POST", "/services", body)
        return serviceSchema.parse(isRecord(created) && "service" in created ? created.service : created)
    }

    async listEnvVars(serviceId: string): Promise<EnvVar[]> {
        const items = envVarListSchema.parse(await this.request("GET", `/services/${serviceId}/env-vars?limit=100`))
        return items.map(i => i.envVar)
    }

    async upsertEnvVar(serviceId: string, key: string, value: string): Promise<void> {
        await this.request("PUT", `/services/${serviceId}/env-vars/${key}`, { value })
    }

    async findKeyValue(ownerId: string, name: string, environmentId: string): Promise<KeyValue | null> {
        const items = keyValueListSchema.parse(await this.request("GET", `/key-value?ownerId=${ownerId}&limit=100`))
        return items.map(i => i.keyValue).find(kv => kv.name === name && kv.environmentId === environmentId) ?? null
    }

    async createKeyValue(input: CreateKeyValueInput): Promise<KeyValue> {
        return keyValueSchema.parse(await this.request("POST", "/key-value", input))
    }

    async getKeyValue(id: string): Promise<KeyValue> {
        return keyValueSchema.parse(await this.request("GET", `/key-value/${id}`))
    }

    async setKeyValueMaxmemoryPolicy(id: string, policy: string): Promise<void> {
        await this.request("PATCH", `/key-value/${id}`, { maxmemoryPolicy: policy })
    }

    async getKeyValueConnection(id: string): Promise<KeyValueConnection> {
        return keyValueConnectionSchema.parse(await this.request("GET", `/key-value/${id}/connection-info`))
    }

    async waitForKeyValueAvailable(id: string, attempts = 40, intervalMs = 5000): Promise<void> {
        for (let i = 0; i < attempts; i++) {
            const kv = await this.getKeyValue(id)
            if (kv.status !== "creating") return
            await sleep(intervalMs)
        }
        throw new SetupError(`Key Value ${id} did not become available in time`)
    }

    private async request(method: string, path: string, body?: unknown): Promise<unknown> {
        const res = await fetch(`${RENDER_API_BASE}${path}`, {
            method,
            headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        })
        if (!res.ok) throw new RenderApiError(method, path, res.status, await res.text())
        if (res.status === 204) return null
        return res.json()
    }
}

// ── arg / env parsing ─────────────────────────────────────────────────────────

function parseEnv(): string {
    const result = envSchema.safeParse(process.env)
    if (!result.success) throw new SetupError("RENDER_API_KEY is required (the same key CI uses)")
    return result.data.RENDER_API_KEY
}

function parseArgs(argv: string[]): Args {
    const args: Mutable<Args> = { webServiceId: "", apply: false, redisPlan: DEFAULT_REDIS_PLAN, maxShutdownDelaySeconds: DEFAULT_MAX_SHUTDOWN_DELAY_SECONDS }
    for (let i = 0; i < argv.length; i++) {
        const [flag, inlineValue] = splitFlag(argv[i])
        const value = (): string => inlineValue ?? argv[++i]
        if (flag === "--apply") args.apply = true
        else if (flag === "--web-service") args.webServiceId = value()
        else if (flag === "--redis-name") args.redisName = value()
        else if (flag === "--worker-name") args.workerName = value()
        else if (flag === "--redis-plan") args.redisPlan = value()
        else if (flag === "--max-shutdown-delay") args.maxShutdownDelaySeconds = parsePositiveInt(value(), flag)
        else throw new SetupError(`Unknown argument: ${argv[i]}`)
    }
    if (!args.webServiceId) throw new SetupError("--web-service <srv-id> is required (the base web service to mirror)")
    return args
}

function splitFlag(arg: string): [string, string | undefined] {
    const eq = arg.indexOf("=")
    return eq === -1 ? [arg, undefined] : [arg.slice(0, eq), arg.slice(eq + 1)]
}

function parsePositiveInt(value: string | undefined, flag: string): number {
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0) throw new SetupError(`${flag} must be a positive integer (got "${value ?? ""}")`)
    return n
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Render queue infra setup failed:", error instanceof Error ? error.message : error)
        process.exit(1)
    })

// ── errors ────────────────────────────────────────────────────────────────────

class SetupError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SetupError"
    }
}

class RenderApiError extends Error {
    constructor(method: string, path: string, status: number, body: string) {
        super(`Render API ${method} ${path} -> ${status}: ${body}`)
        this.name = "RenderApiError"
    }
}

// ── types & schemas ─────────────────────────────────────────────────────────────

const envSchema = z.object({ RENDER_API_KEY: z.string().min(1) })

const serviceSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    ownerId: z.string(),
    environmentId: z.string(),
    repo: z.string(),
    branch: z.string(),
    rootDir: z.string(),
    autoDeploy: z.string(),
    serviceDetails: z.object({
        region: z.string(),
        plan: z.string(),
        runtime: z.string(),
        previews: z.object({ generation: z.string() }).optional(),
        envSpecificDetails: z.object({ buildCommand: z.string(), startCommand: z.string() })
    })
})

const serviceListSchema = z.array(z.object({ service: serviceSchema }))
const envVarSchema = z.object({ key: z.string(), value: z.string().nullable() })
const envVarListSchema = z.array(z.object({ envVar: envVarSchema }))
const keyValueSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    environmentId: z.string(),
    options: z.object({ maxmemoryPolicy: z.string().nullable() }).optional()
})
const keyValueListSchema = z.array(z.object({ keyValue: keyValueSchema }))
const keyValueConnectionSchema = z.object({ internalConnectionString: z.string() })

type Service = z.infer<typeof serviceSchema>
type EnvVar = z.infer<typeof envVarSchema>
type KeyValue = z.infer<typeof keyValueSchema>
type KeyValueConnection = z.infer<typeof keyValueConnectionSchema>

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

interface Args {
    readonly webServiceId: string
    readonly apply: boolean
    readonly redisPlan: string
    readonly maxShutdownDelaySeconds: number
    readonly redisName?: string
    readonly workerName?: string
}

interface EnvVarInput {
    readonly key: string
    readonly value: string
}

interface ServicePatch {
    readonly autoDeploy?: string
    readonly branch?: string
    readonly serviceDetails?: { readonly previews?: { readonly generation: string } }
}

interface CreateKeyValueInput {
    readonly name: string
    readonly ownerId: string
    readonly environmentId: string
    readonly plan: string
    readonly region: string
    readonly maxmemoryPolicy: string
    readonly ipAllowList: readonly never[]
}

interface CreateWorkerInput {
    readonly name: string
    readonly ownerId: string
    readonly repo: string
    readonly branch: string
    readonly rootDir: string
    readonly environmentId: string
    readonly runtime: string
    readonly plan: string
    readonly region: string
    readonly buildCommand: string
    readonly startCommand: string
    readonly maxShutdownDelaySeconds: number
    readonly envVars: readonly EnvVarInput[]
}
