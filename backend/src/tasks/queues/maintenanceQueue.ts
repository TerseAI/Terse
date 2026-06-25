/**
 * Platform maintenance crons. These have no Postgres-backed definition (they were static GCP
 * Cloud Scheduler jobs), so the worker declares them as static BullMQ Job Schedulers on boot.
 * upsert is idempotent, so they self-heal a wiped Redis like the user cron schedulers.
 */
import { getQueue } from "../../loaders/bullmq"

import { QueueName } from "./queueNames"

export const MaintenanceJob = {
    RefreshTokens: "refresh-tokens",
    ClearOldSecretVersions: "clear-old-secret-versions",
    CleanupSdkImages: "cleanup-sdk-images"
} as const

export type MaintenanceJob = (typeof MaintenanceJob)[keyof typeof MaintenanceJob]

/** Cron patterns in UTC. Match these to the prior Cloud Scheduler cadence at decommission time. */
const MAINTENANCE_SCHEDULES: Record<MaintenanceJob, string> = {
    [MaintenanceJob.RefreshTokens]: "0 * * * *", // hourly
    [MaintenanceJob.ClearOldSecretVersions]: "0 3 * * *", // daily 03:00 UTC
    [MaintenanceJob.CleanupSdkImages]: "0 4 * * *" // daily 04:00 UTC
}

/** Declare/refresh the static maintenance schedulers. Throws if Redis is unavailable. */
export async function upsertMaintenanceSchedulers(): Promise<void> {
    const queue = getQueue(QueueName.Maintenance)
    for (const job of Object.values(MaintenanceJob)) {
        await queue.upsertJobScheduler(`maintenance-${job}`, { pattern: MAINTENANCE_SCHEDULES[job], tz: "UTC" }, { name: job })
    }
}
