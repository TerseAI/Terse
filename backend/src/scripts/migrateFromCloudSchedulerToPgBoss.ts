/**
 * One-off migration of user cron triggers AND in-flight run suspensions from GCP Cloud Scheduler
 * to pg-boss.
 *
 * Cloud Scheduler held a derivative copy of each schedule; Postgres is the source of truth and
 * pg-boss now owns firing:
 *   - User crons: automation_time_trigger_configs → one pg-boss schedule per trigger (see
 *     tasks/queues/scheduleQueue.ts). New and edited triggers are scheduled at write time; this
 *     script backfills schedules for triggers that predate the cutover.
 *   - Suspension timers: main's sleep/wait durability parked each suspended run as a one-shot
 *     `terse-suspend-<runId>[-<key>]` job POSTing to /resume — a route this branch deletes. The
 *     open run_suspensions row (kind=timer, resumed_at null) holds the snapshot image and the
 *     intended resume time (created_at + delay_seconds); backfill re-parks each one as a delayed
 *     pg-boss run-execution job with the remaining delay (0 → resume immediately, which also heals
 *     runs whose GCP job already fired into the dead endpoint). Re-running is safe: the exclusive
 *     singletonKey dedupes while a resume is pending, and the worker's claimSuspendedRun gate
 *     drops a resume for a run that is no longer suspended.
 *
 * SAFETY: dry-run is the DEFAULT. Nothing is mutated unless you pass --apply. Recommended sequence:
 *   1. pnpm tsx src/scripts/migrateFromCloudSchedulerToPgBoss.ts --action list
 *        Inventory every Cloud Scheduler job; identify the user crons (terse-schedule-*), the
 *        suspension timers (terse-suspend-*), and the 3 platform maintenance jobs (whose names
 *        were configured manually in GCP).
 *   2. ... --action backfill             (dry run: prints the pg-boss schedules + resume jobs it would create)
 *      ... --action backfill --apply     (creates a pg-boss schedule per unmigrated trigger and a
 *                                         delayed resume job per open timer suspension)
 *        Backfill spans two databases: trigger configs and suspensions are read from DATABASE_URL
 *        (main app DB) while schedules/jobs are written to PGBOSS_DATABASE_URL (the dedicated
 *        queue Postgres from setupRenderInfra.ts). Set BOTH to the target environment's values.
 *        The queue Postgres is internal-only, so run this from a Render shell or temporarily
 *        allowlist your IP. Run this IMMEDIATELY after the cutover deploy: until then, old code
 *        can still park new suspensions in GCP.
 *   3. ... --action pause --apply        (pauses all terse-schedule-* and terse-suspend-* jobs;
 *                                         verify pg-boss fires them)
 *   4. ... --action delete --apply       (deletes all terse-schedule-* and terse-suspend-* jobs)
 *   5. ... --action delete --names <maintenance-job-1>,<maintenance-job-2>,... --apply
 *        (deletes the explicitly-named maintenance jobs once Phase 4 schedulers are confirmed firing)
 *
 * Selection (pause/delete):
 *   default            → all jobs named `terse-schedule-*` (user crons) or `terse-suspend-*`
 *                        (suspension timers), cross-referenced with Postgres.
 *   --names a,b,c      → operate ONLY on these exact GCP job names (use for the maintenance jobs).
 *
 * Dev and prod share this GCP Cloud Scheduler namespace; jobs targeting ngrok tunnels are dev
 * jobs and are always excluded from every action.
 */
import { CloudSchedulerClient } from "@google-cloud/scheduler"
import "dotenv/config"

import { Boss } from "../loaders/pgBoss"
import { db } from "../loaders/prisma"
import { settings } from "../settings"
import { QueueName } from "../tasks/queues/queueNames"
import { enqueueRunExecution } from "../tasks/queues/runExecutionQueue"
import { assertValidUserCron, upsertScheduleTrigger } from "../tasks/queues/scheduleQueue"

const USER_CRON_PREFIX = "terse-schedule-"
const SUSPEND_JOB_PREFIX = "terse-suspend-"

interface ScheduledJob {
    id: string
    schedule: string
    url: string
    state: string
}

/**
 * Minimal, self-contained GCP Cloud Scheduler client. Lives only in this one-off migration
 * script so the main codebase ships no Cloud Scheduler code. Delete this script and the
 * @google-cloud/scheduler dependency once the migration is complete.
 */
class CloudScheduler {
    private client: CloudSchedulerClient
    private parent: string

    constructor() {
        const gcp = settings.gcp!
        const credentials = JSON.parse(Buffer.from(gcp.serviceAccountBase64, "base64").toString("utf-8"))
        this.client = new CloudSchedulerClient({ credentials })
        this.parent = `projects/${gcp.projectId}/locations/${gcp.region}`
    }

    private jobPath(jobId: string): string {
        return `${this.parent}/jobs/${jobId}`
    }

    private stateLabel(state: unknown): string {
        if (state === 1 || state === "ENABLED") return "ENABLED"
        if (state === 2 || state === "PAUSED") return "PAUSED"
        if (state === 3 || state === "DISABLED") return "DISABLED"
        if (state === 4 || state === "UPDATE_FAILED") return "UPDATE_FAILED"
        return "STATE_UNSPECIFIED"
    }

    async list(): Promise<ScheduledJob[]> {
        const all: ScheduledJob[] = []
        let pageToken: string | undefined
        do {
            const [jobs, , response] = await this.client.listJobs({ parent: this.parent, pageSize: 500, pageToken }, { autoPaginate: false })
            all.push(
                ...(jobs ?? []).map(job => ({
                    id: (job.name ?? "").split("/").pop() || (job.name ?? ""),
                    schedule: job.schedule ?? "",
                    url: job.httpTarget?.uri ?? "",
                    state: this.stateLabel(job.state)
                }))
            )
            pageToken = response?.nextPageToken || undefined
        } while (pageToken)
        return all
    }

    async pause(jobId: string): Promise<void> {
        await this.client.pauseJob({ name: this.jobPath(jobId) })
    }

    async delete(jobId: string): Promise<void> {
        await this.client.deleteJob({ name: this.jobPath(jobId) })
    }
}

type Action = "list" | "backfill" | "pause" | "delete"

interface Args {
    action: Action
    apply: boolean
    names: string[]
}

function parseArgs(argv: string[]): Args {
    const args: Args = { action: "list", apply: false, names: [] }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--apply") args.apply = true
        else if (arg === "--action") args.action = parseAction(argv[++i])
        else if (arg.startsWith("--action=")) args.action = parseAction(arg.split("=")[1])
        else if (arg === "--names") args.names = parseNames(argv[++i])
        else if (arg.startsWith("--names=")) args.names = parseNames(arg.split("=")[1])
        else throw new Error(`Unknown argument: ${arg}`)
    }
    return args
}

function parseAction(value: string | undefined): Action {
    if (value === "list" || value === "backfill" || value === "pause" || value === "delete") return value
    throw new Error(`--action must be one of list|backfill|pause|delete (got "${value ?? ""}")`)
}

function parseNames(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
}

/** inputId for a job named `terse-schedule-<inputId>`, else null. */
function inputIdFromJob(jobId: string): string | null {
    return jobId.startsWith(USER_CRON_PREFIX) ? jobId.slice(USER_CRON_PREFIX.length) : null
}

function isSuspendJob(jobId: string): boolean {
    return jobId.startsWith(SUSPEND_JOB_PREFIX)
}

/** Dev and prod share one GCP namespace; dev jobs point at ngrok tunnels. */
function isDevJob(job: ScheduledJob): boolean {
    return job.url.includes("ngrok")
}

async function loadTrackedInputIds(): Promise<Set<string>> {
    const configs = await db().automation_time_trigger_configs.findMany({ select: { automation_input_id: true } })
    return new Set(configs.map(c => c.automation_input_id))
}

interface OpenTimerSuspension {
    runId: string
    imageId: string
    resumeAt: Date
    automation: { id: string; organizationId: string; userId: string; name: string } | null
}

/** Latest open (unresumed) timer suspension per run — the runs parked by main's Cloud Scheduler sleep timers. */
async function loadOpenTimerSuspensions(): Promise<OpenTimerSuspension[]> {
    const rows = await db().run_suspensions.findMany({
        where: { kind: "timer", resumed_at: null },
        orderBy: { created_at: "desc" },
        distinct: ["run_id"],
        select: {
            run_id: true,
            suspend_image_id: true,
            delay_seconds: true,
            created_at: true,
            run_history_record: {
                select: { automation: { select: { id: true, organization_id: true, user_id: true, name: true } } }
            }
        }
    })
    return rows.map(row => ({
        runId: row.run_id,
        imageId: row.suspend_image_id,
        resumeAt: new Date(row.created_at.getTime() + (row.delay_seconds ?? 0) * 1000),
        automation: row.run_history_record.automation
            ? {
                  id: row.run_history_record.automation.id,
                  organizationId: row.run_history_record.automation.organization_id,
                  userId: row.run_history_record.automation.user_id,
                  name: row.run_history_record.automation.name
              }
            : null
    }))
}

/** Creates a pg-boss schedule for every trigger that doesn't have one yet. Needs no GCP access. */
async function runBackfill(apply: boolean): Promise<void> {
    await Boss.getInstance().start("web")

    const configs = await db().automation_time_trigger_configs.findMany({
        select: { automation_input_id: true, cron_expression: true }
    })
    const existing = await Boss.getInstance().getBoss().getSchedules(QueueName.Schedule)
    const existingKeys = new Set(existing.map(schedule => schedule.key))

    let backfilled = 0
    let alreadyScheduled = 0
    let invalid = 0
    for (const { automation_input_id: inputId, cron_expression: cronExpression } of configs) {
        if (existingKeys.has(inputId)) {
            alreadyScheduled++
            continue
        }

        try {
            if (apply) {
                await upsertScheduleTrigger(inputId, cronExpression)
                console.log(`  ✓ scheduled ${inputId}  "${cronExpression}"`)
            } else {
                assertValidUserCron(inputId, cronExpression)
                console.log(`  • [dry-run] would schedule ${inputId}  "${cronExpression}"`)
            }
            backfilled++
        } catch (error) {
            console.error(`  ✗ invalid cron for ${inputId} "${cronExpression}":`, error instanceof Error ? error.message : error)
            invalid++
        }
    }

    console.log(`\nCrons: ${apply ? "" : "(dry run) "}backfilled: ${backfilled}, already scheduled: ${alreadyScheduled}, invalid: ${invalid}`)

    await backfillSuspensions(apply)

    if (!apply) console.log("\nRe-run with --apply to perform these changes.")
    await Boss.getInstance().stop()
}

/**
 * Re-parks every open timer suspension as a delayed pg-boss run-execution job. Overdue timers
 * (GCP job already fired into the removed /resume route, or fired mid-deploy) resume immediately.
 */
async function backfillSuspensions(apply: boolean): Promise<void> {
    const suspensions = await loadOpenTimerSuspensions()
    console.log(`\nOpen timer suspensions: ${suspensions.length}`)

    let enqueued = 0
    let skipped = 0
    for (const suspension of suspensions) {
        const { runId, imageId, resumeAt, automation } = suspension
        if (!automation) {
            console.warn(`  ✗ skipping run ${runId}: automation no longer exists`)
            skipped++
            continue
        }

        const remainingSeconds = Math.max(0, Math.ceil((resumeAt.getTime() - Date.now()) / 1000))
        const when = remainingSeconds === 0 ? "overdue → resume now" : `resume at ${resumeAt.toISOString()} (in ${remainingSeconds}s)`
        if (apply) {
            await enqueueRunExecution(
                {
                    runId,
                    agentId: automation.id,
                    orgId: automation.organizationId,
                    userId: automation.userId,
                    jobName: automation.name,
                    kind: "sandbox",
                    restoreImageId: imageId
                },
                { delaySeconds: remainingSeconds }
            )
            console.log(`  ✓ enqueued resume for run ${runId}  ${when}`)
        } else {
            console.log(`  • [dry-run] would enqueue resume for run ${runId}  ${when}`)
        }
        enqueued++
    }

    console.log(`\nSuspensions: ${apply ? "" : "(dry run) "}resume jobs enqueued: ${enqueued}, skipped: ${skipped}`)
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const banner = args.apply ? "APPLY (mutating)" : "DRY RUN (no changes)"
    console.log(`\n=== Cloud Scheduler → pg-boss migration — action=${args.action} — ${banner} ===\n`)

    if (args.action === "backfill") {
        await runBackfill(args.apply)
        return
    }

    if (!settings.gcp) {
        console.error("GCP is not configured (GCP_SERVICE_ACCOUNT_BASE64 / GCP_PROJECT_ID). Nothing to decommission.")
        process.exit(1)
    }

    const scheduler = new CloudScheduler()
    const listed = await scheduler.list()
    const devJobs = listed.filter(isDevJob)
    const allJobs = listed.filter(job => !isDevJob(job))

    if (args.action === "list") {
        const tracked = await loadTrackedInputIds()
        const openSuspensions = await loadOpenTimerSuspensions()
        const userCrons = allJobs.filter(j => inputIdFromJob(j.id) !== null)
        const suspendJobs = allJobs.filter(j => isSuspendJob(j.id))
        const others = allJobs.filter(j => inputIdFromJob(j.id) === null && !isSuspendJob(j.id))

        console.log(`Total Cloud Scheduler jobs: ${listed.length} (${devJobs.length} dev jobs targeting ngrok — ignored)\n`)
        console.log(`User crons (${USER_CRON_PREFIX}*): ${userCrons.length}`)
        for (const job of userCrons) {
            const inputId = inputIdFromJob(job.id)!
            const label = tracked.has(inputId) ? "tracked" : "ORPHAN (no Postgres time-trigger)"
            console.log(`  - ${job.id}  [${job.state}]  "${job.schedule}"  (${label})`)
        }
        console.log(`\nSuspension timers (${SUSPEND_JOB_PREFIX}*): ${suspendJobs.length}`)
        for (const job of suspendJobs) {
            const hasOpenRow = openSuspensions.some(s => job.id.startsWith(`${SUSPEND_JOB_PREFIX}${s.runId}`))
            const label = hasOpenRow ? "open suspension in Postgres — backfill will re-park it" : "no open suspension row (already resumed/cancelled)"
            console.log(`  - ${job.id}  [${job.state}]  "${job.schedule}"  (${label})`)
        }
        console.log(`Open timer suspensions in Postgres: ${openSuspensions.length} (backfill re-parks each as a delayed pg-boss job)`)
        console.log(`\nOther jobs (likely platform maintenance — confirm names before deleting): ${others.length}`)
        for (const job of others) {
            console.log(`  - ${job.id}  [${job.state}]  "${job.schedule}"  -> ${job.url}`)
        }
        console.log(
            `\nNext: backfill pg-boss schedules + suspension resumes with --action backfill; pause/delete user crons + suspension timers with --action pause|delete; delete maintenance jobs with --action delete --names <name1>,<name2>`
        )
        return
    }

    // pause | delete — determine target set.
    let targets: typeof allJobs
    if (args.names.length > 0) {
        const byId = new Map(allJobs.map(j => [j.id, j]))
        const missing = args.names.filter(n => !byId.has(n))
        if (missing.length > 0) console.warn(`⚠️  Named jobs not found in Cloud Scheduler (skipping): ${missing.join(", ")}`)
        targets = args.names.filter(n => byId.has(n)).map(n => byId.get(n)!)
    } else {
        targets = allJobs.filter(j => inputIdFromJob(j.id) !== null || isSuspendJob(j.id))
    }

    if (targets.length === 0) {
        console.log("No matching jobs to operate on.")
        return
    }

    console.log(`${args.action === "pause" ? "Pausing" : "Deleting"} ${targets.length} job(s):\n`)
    let done = 0
    let skipped = 0
    let failed = 0

    for (const job of targets) {
        if (args.action === "pause" && job.state === "PAUSED") {
            console.log(`  • ${job.id} — already PAUSED, skipping`)
            skipped++
            continue
        }

        if (!args.apply) {
            console.log(`  • [dry-run] would ${args.action} ${job.id}  [${job.state}]`)
            done++
            continue
        }

        try {
            if (args.action === "pause") {
                await scheduler.pause(job.id)
            } else {
                await scheduler.delete(job.id)
            }
            console.log(`  ✓ ${args.action}d ${job.id}`)
            done++
        } catch (error) {
            console.error(`  ✗ failed to ${args.action} ${job.id}:`, error instanceof Error ? error.message : error)
            failed++
        }
    }

    console.log(`\nDone. ${args.apply ? "" : "(dry run) "}${args.action}: ${done}, skipped: ${skipped}, failed: ${failed}`)
    if (!args.apply) console.log("Re-run with --apply to perform these changes.")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Migration script failed:", error)
        process.exit(1)
    })
