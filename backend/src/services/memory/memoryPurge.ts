import logger from "../../common/logger"
import { testMemorySubtreeKey } from "../sdkSandboxLayerKeys"
import { getVolumeManager } from "../volumes"

export async function purgeAutomationsMemory(projectId: string, automationIds: string[]): Promise<void> {
    if (automationIds.length === 0) return
    try {
        const fs = await getVolumeManager().openProjectVolumeFs(projectId)
        try {
            for (const automationId of automationIds) {
                await fs.remove(automationId) // production subtree
                await fs.remove(testMemorySubtreeKey(automationId)) // `terse test` subtree
            }
            await fs.sync()
        } finally {
            await fs.dispose()
        }
        logger.info("memory: purged automation subtrees", { projectId, automationIds })
    } catch (error) {
        logger.warn("memory: purge automation subtrees failed, continuing", { projectId, automationIds, error })
    }
}

/** Delete a project's entire memory volume. Best-effort. */
export async function purgeProjectMemory(projectId: string): Promise<void> {
    try {
        await getVolumeManager().deleteProjectVolume(projectId)
        logger.info("memory: deleted project volume", { projectId })
    } catch (error) {
        logger.warn("memory: delete project volume failed, continuing", { projectId, error })
    }
}
