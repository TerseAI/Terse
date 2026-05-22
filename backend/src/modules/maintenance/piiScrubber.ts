import { Prisma } from "@prisma/client"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

const RETENTION_DAYS = 30
const DEFAULT_BATCH_SIZE = 200
const MAX_ITERATIONS = 200 // safety stop — batch * iterations = max rows per run

export interface ScrubResult {
    scannedBatches: number
    scrubbedRuns: number
    scrubbedActions: number
    scrubbedRawEvents: number
    scrubbedApprovals: number
    scrubbedApprovalSlackMessages: number
    scrubbedNotifications: number
    failures: Array<{ batchIndex: number; error: string }>
}

export async function scrubExpiredRunHistory(options?: { batchSize?: number }): Promise<ScrubResult> {
    const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const prisma = db()

    const result: ScrubResult = {
        scannedBatches: 0,
        scrubbedRuns: 0,
        scrubbedActions: 0,
        scrubbedRawEvents: 0,
        scrubbedApprovals: 0,
        scrubbedApprovalSlackMessages: 0,
        scrubbedNotifications: 0,
        failures: []
    }

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const batch = await prisma.run_history_records.findMany({
            where: {
                timestamp: { lt: cutoff },
                pii_scrubbed_at: null
            },
            select: { id: true },
            orderBy: { timestamp: "asc" },
            take: batchSize
        })

        if (batch.length === 0) break

        const ids = batch.map(r => r.id)
        result.scannedBatches++

        try {
            const counts = await prisma.$transaction(async tx => {
                const actions = await tx.run_history_actions.updateMany({
                    where: { run_history_record_id: { in: ids } },
                    data: { action: "", target: "", details: "", url: null }
                })

                const rawEvents = await tx.run_history_raw_events.updateMany({
                    where: { run_history_record_id: { in: ids } },
                    data: { raw_event_json: { type: "redacted" } }
                })

                const approvals = await tx.pending_approvals.updateMany({
                    where: { run_history_record_id: { in: ids } },
                    data: { serialized_state: "", interruptions: [] }
                })

                const approvalSlack = await tx.approval_slack_messages.updateMany({
                    where: { run_id: { in: ids } },
                    data: { summary: null, rejection_reason: null }
                })

                const notifications = await tx.sent_notifications.updateMany({
                    where: { run_id: { in: ids } },
                    data: { destination_label: "", error_message: null }
                })

                const runs = await tx.run_history_records.updateMany({
                    where: { id: { in: ids }, pii_scrubbed_at: null },
                    data: {
                        trigger_payload: Prisma.DbNull,
                        trigger_title: null,
                        trigger_subheader: null,
                        decision_reason: "",
                        sdk_skills: Prisma.DbNull,
                        pii_scrubbed_at: new Date()
                    }
                })

                return { runs: runs.count, actions: actions.count, rawEvents: rawEvents.count, approvals: approvals.count, approvalSlack: approvalSlack.count, notifications: notifications.count }
            })

            result.scrubbedRuns += counts.runs
            result.scrubbedActions += counts.actions
            result.scrubbedRawEvents += counts.rawEvents
            result.scrubbedApprovals += counts.approvals
            result.scrubbedApprovalSlackMessages += counts.approvalSlack
            result.scrubbedNotifications += counts.notifications

            logger.info("pii scrub batch completed", {
                batchIndex: i,
                runs: counts.runs,
                actions: counts.actions,
                rawEvents: counts.rawEvents,
                approvals: counts.approvals,
                approvalSlack: counts.approvalSlack,
                notifications: counts.notifications
            })

            if (batch.length < batchSize) break
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error"
            logger.error("pii scrub batch failed", { batchIndex: i, error: message, ids })
            result.failures.push({ batchIndex: i, error: message })
            break
        }
    }

    return result
}
