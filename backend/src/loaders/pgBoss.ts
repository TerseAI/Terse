import { PgBoss } from "pg-boss"

import logger from "../common/logger"
import { settings } from "../settings"
import { QueueName } from "../tasks/queues/queueNames"

const POOL_MAX: Record<BossRole, number> = { web: 3, worker: 10 }
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

async function createQueues(boss: PgBoss): Promise<void> {
    await boss.createQueue(QueueName.SdkRunExecution, { policy: "exclusive", retryLimit: 0, expireInSeconds: RUN_EXECUTION_EXPIRE_SECONDS })
    await boss.createQueue(QueueName.Schedule, { retryLimit: 0 })
}

export class BossNotStartedError extends Error {
    constructor() {
        super("pg-boss has not been started — call Boss.getInstance().start(role) during bootstrap")
        this.name = "BossNotStartedError"
    }
}

export type BossRole = "web" | "worker"
