/**
 * Platform maintenance crons. These have no Postgres-backed definition (they were static GCP
 * Cloud Scheduler jobs), so the worker declares them as native pg-boss schedules on boot — one
 * queue per job so each is worked and observed independently. schedule() upserts, so a re-boot
 * self-heals a wiped queue store.
 */
import { Boss } from "../../loaders/pgBoss"

export const MaintenanceJob = {
    RefreshTokens: "refresh-tokens",
    ClearOldSecretVersions: "clear-old-secret-versions",
    CleanupSdkImages: "cleanup-sdk-images",
    ReviewAgents: "review-agents"
} as const

/** Cron patterns in UTC. Match these to the prior Cloud Scheduler cadence at decommission time. */
const MAINTENANCE_SCHEDULES: Record<MaintenanceJob, string> = {
    [MaintenanceJob.RefreshTokens]: "0 * * * *", // hourly
    [MaintenanceJob.ClearOldSecretVersions]: "0 3 * * *", // daily 03:00 UTC
    [MaintenanceJob.CleanupSdkImages]: "0 4 * * *", // daily 04:00 UTC
    [MaintenanceJob.ReviewAgents]: "0 13 * * 1" // weekly, Monday 13:00 UTC
}

export function maintenanceQueueName(job: MaintenanceJob): string {
    return `maintenance-${job}`
}

/** Declare/refresh the static maintenance queues and schedules. Throws if Postgres is unavailable. */
export async function upsertMaintenanceSchedulers(): Promise<void> {
    const boss = Boss.getInstance().getBoss()
    for (const job of Object.values(MaintenanceJob)) {
        await boss.createQueue(maintenanceQueueName(job), { retryLimit: 0 })
        await boss.schedule(maintenanceQueueName(job), MAINTENANCE_SCHEDULES[job], {}, { tz: "UTC" })
    }
}

export type MaintenanceJob = (typeof MaintenanceJob)[keyof typeof MaintenanceJob]
