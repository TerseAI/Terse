import crypto from "crypto"

function hexHead(s: string, maxLen: number): string {
    const hex = s.replace(/[^a-fA-F0-9]/g, "")
    return hex.slice(0, maxLen)
}

function sourceLayerKeyHexBody(sourceLayerKey: string): string {
    if (sourceLayerKey.startsWith("src-")) {
        return hexHead(sourceLayerKey.slice(4), 32)
    }
    return hexHead(sourceLayerKey, 32)
}

export function computeSourceLayerKey(params: { organizationId: string; dependencyHash: string; sourceHash: string }): string {
    const digest = crypto.createHash("sha256").update(params.organizationId).update("\0").update(params.dependencyHash).update("\0").update(params.sourceHash).digest("hex").slice(0, 32)

    return `src-${digest}`
}

export function dependencyBuildSandboxUniqueName(dependencyHash: string): string {
    return `db-${hexHead(dependencyHash, 32)}`
}

export function sourceImageBuildSandboxUniqueName(sourceLayerKey: string): string {
    return `sb-${sourceLayerKeyHexBody(sourceLayerKey)}`
}

export function runtimeSandboxUniqueName(projectId: string, runId: string): string {
    const digest = crypto.createHash("sha256").update(projectId).update("\0").update(runId).digest("hex").slice(0, 32)
    return `sr-${digest}`
}

export const SDK_SANDBOX_APP_NAME = "terse-sdk-sandbox"

export function projectVolumeName(projectId: string): string {
    return `mem-${projectId}`
}

export function testMemorySubtreeKey(automationId: string): string {
    return `test-${automationId}`
}

/** State subtree for a job's typed `states`, a sibling of the agent's memory subtree so the memory tool can't reach it. */
export function stateSubtreeKey(automationId: string, isTest: boolean): string {
    return isTest ? `state-test-${automationId}` : `state-${automationId}`
}

export function memorySubtreeKey(automationId: string, isTest: boolean): string {
    return isTest ? testMemorySubtreeKey(automationId) : automationId
}

export function replayMemorySubtreeKey(replayRunId: string): string {
    return `replay-${replayRunId}`
}

export function replayStateSubtreeKey(replayRunId: string): string {
    return `state-replay-${replayRunId}`
}
