/**
 * pg-boss wiring — the durable job queues (run execution, user cron fan-out, platform maintenance)
 * live in Postgres under the `pgboss` schema, so queued jobs survive restarts. Redis remains for
 * ephemeral concerns only (pub/sub, Socket.IO adapter, rate limiting).
 *
 * One PgBoss instance per process. The web role only enqueues, so it skips scheduling and
 * maintenance supervision and runs a smaller pool; the worker role runs both. The pool is
 * additive to Prisma's — keep `max` small (PGBOSS_MAX_CONNECTIONS to override).
 */
import { PgBoss } from "pg-boss"

import logger from "../common/logger"
import { settings } from "../settings"
import { QueueName } from "../tasks/queues/queueNames"

const POOL_MAX: Record<BossRole, number> = { web: 3, worker: 10 }

// Ceiling for a single run in the active state. An expired job is failed (retryLimit 0 — a
// side-effecting run is never re-delivered), and orphan reconciliation finalizes its run record.
const RUN_EXECUTION_EXPIRE_SECONDS = 3600

export class Boss {
    private static instance: Boss
    private boss: PgBoss | null = null

    private constructor() {}

    public static getInstance(): Boss {
        if (!Boss.instance) {
            Boss.instance = new Boss()
        }
        return Boss.instance
    }

    public getBoss(): PgBoss {
        if (!this.boss) {
            throw new BossNotStartedError()
        }
        return this.boss
    }

    /** Idempotent. Provisions/migrates the pgboss schema and the queues both roles rely on. */
    public async start(role: BossRole): Promise<void> {
        if (this.boss) return
        const boss = new PgBoss({
            connectionString: settings.database.url,
            schema: "pgboss",
            application_name: `terse-pgboss-${role}`,
            max: settings.pgboss.maxConnections ?? POOL_MAX[role],
            ...(role === "web" ? { supervise: false, schedule: false } : {})
        })
        boss.on("error", error => logger.error(`[pgboss:${role}] error`, { message: error.message, error }))
        boss.on("warning", warning => logger.warn(`[pgboss:${role}] warning`, { message: warning.message, warning }))
        await boss.start()
        await createQueues(boss)
        this.boss = boss
        logger.info(`[pgboss:${role}] started`)
    }

    /** Drains in-flight jobs, stops scheduling/maintenance, and closes the pool. */
    public async stop(): Promise<void> {
        if (!this.boss) return
        await this.boss.stop({ graceful: true, timeout: 25_000, close: true })
        this.boss = null
    }
}

/** Maintenance queues are provisioned alongside their schedules in upsertMaintenanceSchedulers. */
async function createQueues(boss: PgBoss): Promise<void> {
    // `exclusive` + the run's singletonKey = at most one queued-or-active job per run, so an
    // at-least-once enqueue can't start a second sandbox. (singletonKey alone doesn't dedupe on a
    // standard-policy queue; note createQueue can't change the policy of an existing queue.)
    await boss.createQueue(QueueName.SdkRunExecution, { policy: "exclusive", retryLimit: 0, expireInSeconds: RUN_EXECUTION_EXPIRE_SECONDS })
    await boss.createQueue(QueueName.Schedule, { retryLimit: 0 })
    await boss.createQueue(QueueName.ScheduleDispatch, { retryLimit: 0 })
}

export class BossNotStartedError extends Error {
    constructor() {
        super("pg-boss has not been started — call Boss.getInstance().start(role) during bootstrap")
        this.name = "BossNotStartedError"
    }
}

export type BossRole = "web" | "worker"
