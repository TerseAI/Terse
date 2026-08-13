import crypto from "crypto"

function hexHead(s: string, maxLen: number): string {
    const hex = s.replace(/[^a-fA-F0-9]/g, "")
    return hex.slice(0, maxLen)
}

export function deployBuildSandboxUniqueName(buildHash: string): string {
    return `db-${hexHead(buildHash, 32)}`
}

/** One package cache per organization: a build can only ever poison its own tenant's cache. */
export function organizationCacheVolumeName(organizationId: string): string {
    return `pkgcache-${organizationId}`
}

/** Mount point of that volume during a build. */
export const SANDBOX_CACHE_MOUNT_PATH = "/opt/terse-package-cache"
export const NPM_CACHE_PATH = `${SANDBOX_CACHE_MOUNT_PATH}/npm`
export const PNPM_STORE_PATH = `${SANDBOX_CACHE_MOUNT_PATH}/pnpm`

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
