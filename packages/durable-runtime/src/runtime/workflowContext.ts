import { AsyncLocalStorage } from "node:async_hooks"

import type { JournalStore } from "../types/journalStore.js"

import type { DeterministicIdGenerator } from "./deterministicIdGenerator.js"

export type WorkflowContext = {
    readonly runId: string
    readonly journalStore: JournalStore
    readonly idGenerator: DeterministicIdGenerator
}

const workflowContext = new AsyncLocalStorage<WorkflowContext>()

export function getWorkflowContext(): WorkflowContext {
    const context = workflowContext.getStore()

    if (!context) {
        throw new Error("Durable operations must be called from within a workflow")
    }

    return context
}

export function runWithWorkflowContext<Output>(context: WorkflowContext, run: () => Output): Output {
    return workflowContext.run(context, run)
}
