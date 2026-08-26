import { AsyncLocalStorage } from "node:async_hooks"

import type { JournalStore } from "../types/journalStore.js"
import type { Suspension } from "../types/runtimeOutcome.js"

import type { DeterministicIdGenerator } from "./deterministicIdGenerator.js"

export type LogicalClock = {
    readonly now: () => number
    readonly advanceTo: (timestamp: number) => void
}

export type WorkflowContext = {
    readonly runId: string
    readonly journalStore: JournalStore
    readonly idGenerator: DeterministicIdGenerator
    readonly suspend: (suspension: Suspension) => void
    readonly logicalClock: LogicalClock
    readonly phase: "step" | "workflow"
}

const workflowContext = new AsyncLocalStorage<WorkflowContext>()

export function getWorkflowContext(): WorkflowContext {
    const context = getOptionalWorkflowContext()

    if (!context) {
        throw new Error("Durable operations must be called from within a workflow")
    }

    return context
}

export function getOptionalWorkflowContext(): WorkflowContext | undefined {
    return workflowContext.getStore()
}

export function runWithWorkflowContext<Output>(context: WorkflowContext, run: () => Output): Output {
    return workflowContext.run(context, run)
}

export function runWithStepContext<Output>(run: () => Output): Output {
    const context = getWorkflowContext()
    return workflowContext.run({ ...context, phase: "step" }, run)
}
