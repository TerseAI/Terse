import { getOptionalWorkflowContext } from "./workflowContext.js"

const nativeRandom = Math.random

function workflowRandom(): number {
    const context = getOptionalWorkflowContext()

    if (!context || context.phase === "step") return nativeRandom()
    return context.random()
}

export function installWorkflowRandom(): void {
    if (Math.random !== workflowRandom) Math.random = workflowRandom
}
