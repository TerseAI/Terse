import type { SdkDeployJob } from "terse-types"

import { db } from "../loaders/prisma"

import { extractErrorMessage } from "./strings"

const FAILURE_REASON_MAX_LENGTH = 500

export async function markDeployFailed(prisma: ReturnType<typeof db>, deployId: string, error: unknown) {
    await prisma.project_deploys.update({
        where: { id: deployId },
        data: {
            status: "FAILED",
            completed_at: new Date(),
            failure_reason: extractErrorMessage(error).slice(0, FAILURE_REASON_MAX_LENGTH)
        }
    })
}

export async function markDeploySucceeded(prisma: ReturnType<typeof db>, deployId: string, jobs: SdkDeployJob[], jobsAdded: number, jobsRemoved: number) {
    await prisma.$transaction([
        prisma.project_deploy_jobs.createMany({
            data: jobs.map(job => ({
                deploy_id: deployId,
                job_name: job.jobName,
                durable_journal_backend: job.durableJournalBackend ?? null
            })),
            skipDuplicates: true
        }),
        prisma.project_deploys.update({
            where: { id: deployId },
            data: {
                status: "SUCCEEDED",
                completed_at: new Date(),
                jobs_added: jobsAdded,
                jobs_removed: jobsRemoved
            }
        })
    ])
}
