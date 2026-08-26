import { NativeDate } from "./systemClock.js"
import { getOptionalWorkflowContext } from "./workflowContext.js"

const WorkflowDate = function Date(this: unknown, ...args: unknown[]): Date | string {
    const timestamp = currentTimestamp()

    if (new.target === undefined) return new NativeDate(timestamp).toString()

    return Reflect.construct(NativeDate, args.length === 0 ? [timestamp] : args, new.target) as Date
} as unknown as DateConstructor

Object.defineProperty(WorkflowDate, "prototype", {
    value: NativeDate.prototype
})
Object.setPrototypeOf(WorkflowDate, NativeDate)
Object.defineProperty(WorkflowDate, "now", {
    value: currentTimestamp
})

export function installWorkflowDate(): void {
    if (globalThis.Date !== WorkflowDate) globalThis.Date = WorkflowDate
}

function currentTimestamp(): number {
    const context = getOptionalWorkflowContext()

    if (!context) return NativeDate.now()
    if (context.phase === "step") return NativeDate.now()
    return context.logicalClock.now()
}
