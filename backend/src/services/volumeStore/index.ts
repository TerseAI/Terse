import { NotFoundError } from "modal"

import logger from "../../common/logger"
import { getSandboxProvider } from "../sandboxProvider"

import { LocalVolumeStore } from "./LocalVolumeStore"
import { ModalVolumeStore } from "./ModalVolumeStore"
import type { AgentVolumeStore } from "./types"
import { agentFilesVolumeName, agentMemoryVolumeName } from "./volumePaths"

let store: AgentVolumeStore | null = null

export function getAgentVolumeStore(): AgentVolumeStore {
    if (store) {
        return store
    }

    const provider = getSandboxProvider()
    store = provider.supportsContainerizedRunners ? new ModalVolumeStore() : new LocalVolumeStore()
    return store
}

/** Test helper — reset singleton between tests. */
export function resetAgentVolumeStoreForTests(): void {
    store = null
}

/** Remove persistent files + memory volumes for an agent. Failures are logged but not thrown. */
export async function deleteAgentVolumes(organizationId: string, agentId: string): Promise<void> {
    const sandboxService = getSandboxProvider()
    const volumeNames = [agentFilesVolumeName(organizationId, agentId), agentMemoryVolumeName(organizationId, agentId)]

    for (const volumeName of volumeNames) {
        try {
            await sandboxService.deleteVolume(volumeName)
            logger.info("Deleted agent volume", { agentId, volumeName })
        } catch (error) {
            if (error instanceof NotFoundError) {
                logger.debug("Agent volume already absent", { agentId, volumeName })
                continue
            }
            logger.warn("Failed to delete agent volume", { agentId, volumeName, error })
        }
    }

    if (store instanceof ModalVolumeStore) {
        store.evictCache(volumeNames)
    }
}

export async function deleteAgentVolumesForAgents(agents: Array<{ organizationId: string; agentId: string }>): Promise<void> {
    await Promise.all(agents.map(({ organizationId, agentId }) => deleteAgentVolumes(organizationId, agentId)))
}

export type { AgentVolumeStore, VolumeFileEntry, VolumeStat } from "./types"
export {
    AGENT_FILES_MOUNT_PATH,
    AGENT_MEMORY_MOUNT_PATH,
    MEMORY_ROOT,
    agentFilesVolumeName,
    agentMemoryVolumeName,
    resolveVolumeRelativePath
} from "./volumePaths"
