/**
 * One-off decommission of GCP Cloud Scheduler now that crons run on BullMQ (Job Schedulers).
 *
 * Cloud Scheduler held a derivative copy of each schedule; Postgres (automation_time_trigger_configs)
 * is the source of truth and the BullMQ worker rebuilds schedulers from it. This script pauses, then
 * (after a soak) deletes the GCP jobs.
 *
 * SAFETY: dry-run is the DEFAULT. Nothing is mutated unless you pass --apply. Recommended sequence:
 *   1. pnpm tsx src/scripts/decommissionCloudScheduler.ts --action list
 *        Inventory every Cloud Scheduler job; identify the user crons (terse-schedule-*) and the
 *        3 platform maintenance jobs (whose names were configured manually in GCP).
 *   2. ... --action pause                 (dry run: prints what it would pause)
 *      ... --action pause --apply         (pauses all terse-schedule-* jobs; verify nothing breaks)
 *   3. ... --action delete --apply        (deletes all terse-schedule-* jobs)
 *   4. ... --action delete --names <maintenance-job-1>,<maintenance-job-2>,... --apply
 *        (deletes the explicitly-named maintenance jobs once Phase 4 schedulers are confirmed firing)
 *
 * Selection:
 *   default            → all jobs named `terse-schedule-*` (user crons), cross-referenced with
 *                        Postgres and labelled tracked|orphan.
 *   --names a,b,c      → operate ONLY on these exact GCP job names (use for the maintenance jobs).
 */
import { CloudSchedulerClient } from "@google-cloud/scheduler"
import "dotenv/config"

import { db } from "../loaders/prisma"
import { settings } from "../settings"

const USER_CRON_PREFIX = "terse-schedule-"

interface ScheduledJob {
    id: string
    schedule: string
    url: string
    state: string
}

/**
 * Minimal, self-contained GCP Cloud Scheduler client. Lives only in this one-off decommission
 * script so the main codebase ships no Cloud Scheduler code. Delete this script and the
 * @google-cloud/scheduler dependency once decommission is complete.
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
            const [jobs, , response] = await this.client.listJobs({ parent: this.parent, pageSize: 500, pageToken })
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

type Action = "list" | "pause" | "delete"

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
    if (value === "list" || value === "pause" || value === "delete") return value
    throw new Error(`--action must be one of list|pause|delete (got "${value ?? ""}")`)
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

async function loadTrackedInputIds(): Promise<Set<string>> {
    const configs = await db().automation_time_trigger_configs.findMany({ select: { automation_input_id: true } })
    return new Set(configs.map(c => c.automation_input_id))
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))

    if (!settings.gcp) {
        console.error("GCP is not configured (GCP_SERVICE_ACCOUNT_BASE64 / GCP_PROJECT_ID). Nothing to decommission.")
        process.exit(1)
    }

    const scheduler = new CloudScheduler()
    const banner = args.apply ? "APPLY (mutating)" : "DRY RUN (no changes)"
    console.log(`\n=== Cloud Scheduler decommission — action=${args.action} — ${banner} ===\n`)

    const allJobs = await scheduler.list()

    if (args.action === "list") {
        const tracked = await loadTrackedInputIds()
        const userCrons = allJobs.filter(j => inputIdFromJob(j.id) !== null)
        const others = allJobs.filter(j => inputIdFromJob(j.id) === null)

        console.log(`Total Cloud Scheduler jobs: ${allJobs.length}\n`)
        console.log(`User crons (${USER_CRON_PREFIX}*): ${userCrons.length}`)
        for (const job of userCrons) {
            const inputId = inputIdFromJob(job.id)!
            const label = tracked.has(inputId) ? "tracked" : "ORPHAN (no Postgres time-trigger)"
            console.log(`  - ${job.id}  [${job.state}]  "${job.schedule}"  (${label})`)
        }
        console.log(`\nOther jobs (likely platform maintenance — confirm names before deleting): ${others.length}`)
        for (const job of others) {
            console.log(`  - ${job.id}  [${job.state}]  "${job.schedule}"  -> ${job.url}`)
        }
        console.log(`\nNext: pause/delete user crons with --action pause|delete; delete maintenance jobs with --action delete --names <name1>,<name2>`)
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
        targets = allJobs.filter(j => inputIdFromJob(j.id) !== null)
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
        console.error("Decommission script failed:", error)
        process.exit(1)
    })
