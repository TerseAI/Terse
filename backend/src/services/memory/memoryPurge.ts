import logger from "../../common/logger"
import { memorySubtreeKey, stateSubtreeKey } from "../sdkSandboxLayerKeys"
import { VolumeManagerProvider } from "../volumes"

export async function purgeAutomationsMemory(projectId: string, automationIds: string[]): Promise<void> {
    if (automationIds.length === 0) return
    try {
        const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(projectId)
        try {
            for (const automationId of automationIds) {
                for (const isTest of [false, true]) {
                    await fs.remove(memorySubtreeKey(automationId, isTest))
                    await fs.remove(stateSubtreeKey(automationId, isTest))
                }
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
        await VolumeManagerProvider.getInstance().deleteProjectVolume(projectId)
        logger.info("memory: deleted project volume", { projectId })
    } catch (error) {
        logger.warn("memory: delete project volume failed, continuing", { projectId, error })
    }
}
