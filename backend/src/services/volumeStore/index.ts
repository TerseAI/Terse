import { NotFoundError } from "modal"

import logger from "../../common/logger"
import { getSandboxProvider } from "../sandboxProvider"

import { LocalVolumeStore } from "./LocalVolumeStore"
import type { AgentVolumeStore } from "./types"
import { agentFilesVolumeName, agentMemoryVolumeName, projectVolumeName } from "./volumePaths"

let store: AgentVolumeStore | null = null

/**
 * The backend-local store used as the non-Modal fallback for memory/filesystem (self-host and
 * local dev). On Modal the tools reach back into the job sandbox's co-located volume instead
 * (see services/sandboxReach.ts), so this is never the Modal path.
 */
export function getAgentVolumeStore(): AgentVolumeStore {
    if (!store) {
        store = new LocalVolumeStore()
    }
    return store
}

/** Test helper — reset singleton between tests. */
export function resetAgentVolumeStoreForTests(): void {
    store = null
}

async function deleteVolumeByName(volumeName: string, context: Record<string, unknown>): Promise<void> {
    try {
        await getSandboxProvider().deleteVolume(volumeName)
        logger.info("Deleted volume", { volumeName, ...context })
    } catch (error) {
        if (error instanceof NotFoundError) {
            logger.debug("Volume already absent", { volumeName, ...context })
            return
        }
        logger.warn("Failed to delete volume", { volumeName, ...context, error })
    }
}

/** Remove the shared per-project volume (memory + filesystem) on project deletion. */
export async function deleteProjectVolume(organizationId: string, projectId: string): Promise<void> {
    await deleteVolumeByName(projectVolumeName(organizationId, projectId), { projectId })
}

/** Legacy per-agent volume cleanup (fallback-store names). Best-effort; failures are logged. */
export async function deleteAgentVolumes(organizationId: string, agentId: string): Promise<void> {
    const volumeNames = [agentFilesVolumeName(organizationId, agentId), agentMemoryVolumeName(organizationId, agentId)]
    for (const volumeName of volumeNames) {
        await deleteVolumeByName(volumeName, { agentId })
    }
}

export async function deleteAgentVolumesForAgents(agents: Array<{ organizationId: string; agentId: string }>): Promise<void> {
    await Promise.all(agents.map(({ organizationId, agentId }) => deleteAgentVolumes(organizationId, agentId)))
}

export type { AgentVolumeStore, VolumeFileEntry } from "./types"
export { MEMORY_ROOT, PROJECT_VOLUME_MOUNT, agentFilesVolumeName, agentMemoryVolumeName, formatHumanSize, projectVolumeName, resolveVolumeRelativePath } from "./volumePaths"
