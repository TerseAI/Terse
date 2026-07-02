import { Boss } from "../../loaders/pgBoss"

export const MaintenanceJob = {
    RefreshTokens: "refresh-tokens",
    ClearOldSecretVersions: "clear-old-secret-versions",
    CleanupSdkImages: "cleanup-sdk-images",
    ReviewAgents: "review-agents",
    ReconcileOrphanedRuns: "reconcile-orphaned-runs"
} as const

const MAINTENANCE_SCHEDULES: Record<MaintenanceJob, string> = {
    [MaintenanceJob.RefreshTokens]: "0 * * * *",
    [MaintenanceJob.ClearOldSecretVersions]: "0 3 * * *",
    [MaintenanceJob.CleanupSdkImages]: "0 4 * * *",
    [MaintenanceJob.ReviewAgents]: "0 13 * * 1",
    [MaintenanceJob.ReconcileOrphanedRuns]: "*/15 * * * *"
}

export function maintenanceQueueName(job: MaintenanceJob): string {
    return `maintenance-${job}`
}

export async function upsertMaintenanceSchedulers(): Promise<void> {
    const boss = Boss.getInstance().getBoss()
    for (const job of Object.values(MaintenanceJob)) {
        await boss.createQueue(maintenanceQueueName(job), { retryLimit: 0 })
        await boss.schedule(maintenanceQueueName(job), MAINTENANCE_SCHEDULES[job], {}, { tz: "UTC" })
    }
}

export type MaintenanceJob = (typeof MaintenanceJob)[keyof typeof MaintenanceJob]
