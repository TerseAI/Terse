import { PgBoss } from "pg-boss"

import logger from "../common/logger"
import { settings } from "../settings"
import { QueueName } from "../tasks/queues/queueNames"

const POOL_MAX: Record<BossRole, number> = { web: 3, worker: 10 }
const RUN_EXECUTION_EXPIRE_SECONDS = 3600

// Every PR preview (web + worker pair) shares the one small staging queue database. At the
// pg-boss defaults (~2s polls per work() registration, 60s supervision loops, 13 pool
// connections per pair) a handful of open PRs is enough to OOM it into a crash loop, which
// takes down staging and preview deploys with ECONNREFUSED. Previews don't need low job
// latency, so back everything off hard there. Staging/production cadence is unchanged.
const PREVIEW_POOL_MAX: Record<BossRole, number> = { web: 2, worker: 3 }
const PREVIEW_INSTANCE_TUNING = {
    superviseIntervalSeconds: 300,
    maintenanceIntervalSeconds: 300,
    queueCacheIntervalSeconds: 300,
    monitorIntervalSeconds: 300,
    bamIntervalSeconds: 300,
    flowIntervalSeconds: 300,
    clockMonitorIntervalSeconds: 600,
    cronWorkerIntervalSeconds: 60,
    cronMonitorIntervalSeconds: 300
}

/**
 * Spread into boss.work() options: previews relax the 2s default poll. Queues E2E tests wait
 * on (run execution, schedule triggers) keep a snappier 5s; maintenance queues idle at 30s.
 */
export const WORK_POLLING = {
    latencySensitive: (settings.isPreviewEnv ? { pollingIntervalSeconds: 5 } : {}) as { pollingIntervalSeconds?: number },
    background: (settings.isPreviewEnv ? { pollingIntervalSeconds: 30 } : {}) as { pollingIntervalSeconds?: number }
}

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

    public async start(role: BossRole): Promise<void> {
        if (this.boss) return
        const boss = new PgBoss({
            connectionString: settings.pgboss.databaseUrl ?? settings.database.url,
            schema: "pgboss",
            application_name: `terse-pgboss-${role}`,
            max: settings.pgboss.maxConnections ?? (settings.isPreviewEnv ? PREVIEW_POOL_MAX : POOL_MAX)[role],
            ...(settings.isPreviewEnv ? PREVIEW_INSTANCE_TUNING : {}),
            ...(role === "web" ? { supervise: false, schedule: false } : {})
        })
        boss.on("error", error => logger.error(`[pgboss:${role}] error`, { message: error.message, error }))
        boss.on("warning", warning => logger.warn(`[pgboss:${role}] warning`, { message: warning.message, warning }))
        await boss.start()
        await createQueues(boss)
        this.boss = boss
        logger.info(`[pgboss:${role}] started`)
    }

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
