import { Queue, QueueOptions, QueuePayload, ValidQueueName } from "@workflow/world"
import type { LocalWorld } from "@workflow/world-local"
import { createLocalWorld } from "@workflow/world-local"
import path from "path"
import { ApiRoutes } from "terse-types"
import type { SdkJobSuspendRequestBody, SdkJobSuspendResponseBody } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "./api.js"

export type TerseWorld = LocalWorld

// Waits shorter than this stay in-process: tearing down and respawning a sandbox
// costs more than just waiting, so only longer waits hand off to Terse.
const SUSPEND_THRESHOLD_SECONDS = Number(process.env.TERSE_SUSPEND_THRESHOLD_SECONDS) || 30

export function createTerseWorld(): TerseWorld {
    const dataDir = process.env.WORKFLOW_LOCAL_DATA_DIR ?? path.join(process.cwd(), ".terse", "data")
    const base = createLocalWorld({ dataDir })
    const baseQueue: Queue["queue"] = base.queue.bind(base)

    return {
        ...base,
        processExitTriggersQueueRedelivery: true,
        queue: terseQueue(baseQueue)
    }
}

// helpers

function terseQueue(baseQueue: Queue["queue"]): Queue["queue"] {
    return (name: ValidQueueName, message: QueuePayload, opts?: QueueOptions) => {
        if (opts?.delaySeconds && opts.delaySeconds > SUSPEND_THRESHOLD_SECONDS) {
            return scheduleTerseTimer(name, message, opts).then(() => ({ messageId: null }))
        }
        return baseQueue(name, message, opts)
    }
}

async function scheduleTerseTimer(name: ValidQueueName, message: QueuePayload, opts: QueueOptions): Promise<{ messageId: null }> {
    const runId = extractRunId(message)
    if (!runId) {
        throw new Error(`Cannot suspend a delayed queue message without a run id (queue "${name}").`)
    }

    const delaySeconds = opts.delaySeconds
    if (!delaySeconds || delaySeconds <= 0) {
        throw new Error(`scheduleTerseTimer requires a positive delaySeconds (queue "${name}").`)
    }

    const apiKey = readApiKeyOrBail()
    const body: SdkJobSuspendRequestBody = {
        runId,
        name,
        delaySeconds,
        ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {})
    }
    await fetchWithAuth<SdkJobSuspendResponseBody>(ApiRoutes.SDK.SUSPEND, apiKey, body, "POST")

    return { messageId: null }
}

function extractRunId(message: QueuePayload): string | undefined {
    if ("runId" in message && typeof message.runId === "string") return message.runId
    if ("workflowRunId" in message && typeof message.workflowRunId === "string") return message.workflowRunId
    return undefined
}
