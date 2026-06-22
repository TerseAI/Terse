import { NotFoundError } from "modal"

import logger from "../../common/logger"
import { getSandboxProvider } from "../sandboxProvider"
import type { SandboxService, SandboxVolume } from "../sandboxProvider/SandboxService"

import { LocalVolumeStore } from "./LocalVolumeStore"
import type { AgentVolumeStore } from "./types"
import { PROJECT_VOLUME_MOUNT, agentFilesVolumeName, agentMemoryVolumeName, projectVolumeName } from "./volumePaths"

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

/**
 * The shared project volume mounted into every runtime sandbox (containerized runners only); each
 * job reads/writes its own subtree under agentFsRoot(agentId). Returns the mount, or undefined for
 * non-containerized runners (self-host uses the backend LocalVolumeStore fallback).
 */
export async function getProjectVolumeMount(sandboxService: SandboxService, organizationId: string, projectId: string): Promise<Record<string, SandboxVolume> | undefined> {
    if (!sandboxService.supportsContainerizedRunners) return undefined
    const volume = await sandboxService.getOrCreateVolume(projectVolumeName(organizationId, projectId))
    return { [PROJECT_VOLUME_MOUNT]: volume }
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

/** Remove one agent's subtree from the shared project volume (containerized runners only). */
async function deleteAgentSubtree(organizationId: string, projectId: string, agentId: string): Promise<void> {
    const provider = getSandboxProvider()
    if (!provider.supportsContainerizedRunners) return
    try {
        await provider.deleteVolumePath(projectVolumeName(organizationId, projectId), agentId)
        logger.info("Deleted agent volume subtree", { agentId, projectId })
    } catch (error) {
        if (error instanceof NotFoundError) return
        logger.warn("Failed to delete agent volume subtree", { agentId, projectId, error })
    }
}

/**
 * Clean up one agent's storage on deletion: the self-host fallback per-agent volumes, plus (when
 * projectId is given) its subtree on the shared project volume. Pass projectId when a single agent
 * is removed; omit it when the whole project volume is being deleted separately. Best-effort.
 */
export async function deleteAgentVolumes(organizationId: string, agentId: string, projectId?: string): Promise<void> {
    const volumeNames = [agentFilesVolumeName(organizationId, agentId), agentMemoryVolumeName(organizationId, agentId)]
    for (const volumeName of volumeNames) {
        await deleteVolumeByName(volumeName, { agentId })
    }
    if (projectId) {
        await deleteAgentSubtree(organizationId, projectId, agentId)
    }
}

export async function deleteAgentVolumesForAgents(agents: Array<{ organizationId: string; agentId: string; projectId?: string }>): Promise<void> {
    await Promise.all(agents.map(({ organizationId, agentId, projectId }) => deleteAgentVolumes(organizationId, agentId, projectId)))
}

export type { AgentVolumeStore, VolumeFileEntry } from "./types"
export { MEMORY_ROOT, PROJECT_VOLUME_MOUNT, agentFilesVolumeName, agentMemoryVolumeName, formatHumanSize, projectVolumeName, resolveVolumeRelativePath } from "./volumePaths"
