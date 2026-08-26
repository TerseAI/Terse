import type { StepEventType } from "./stepEventType.js"

export type CreateStepEventIdParams = {
    readonly type: StepEventType
    readonly stepId: string
}

export function createStepEventId({ type, stepId }: CreateStepEventIdParams): string {
    return `${type}:${stepId}`
}
