import { SdkInputResponsePayload, UserSession } from "terse-types/types"

import { AgentWithRelations } from "../../types/prisma"

export type JobExecutionKind = "sandbox" | "remote-webhook"

export interface JobExecutionContext {
    readonly runId: string
    readonly agent: AgentWithRelations
    readonly orgId: string
    readonly userId: string
    readonly user: UserSession
    readonly jobName: string
    /** Journal snapshot image to restore when resuming a suspended run. */
    readonly restoreImageId?: string
    /** Input response to inject when resuming a run parked on a workflow hook. */
    readonly hookResume?: HookResume
}

export type HookResume = {
    readonly token: string
    readonly payload: SdkInputResponsePayload
}

export type RunOutcome = { status: "success" } | { status: "skipped"; reason: string } | { status: "suspended" } | { status: "failed"; cause: unknown }

export interface JobExecutor {
    readonly kind: JobExecutionKind
    execute(context: JobExecutionContext): Promise<RunOutcome>
}
