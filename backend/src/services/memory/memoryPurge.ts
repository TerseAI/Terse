import logger from "../../common/logger"
import { getSandboxProvider } from "../sandboxProvider"

/**
 * Remove the memory subtrees of the given automations from a project's volume. Best-effort: a failure
 * is logged and swallowed so it never blocks the deletion that triggered it. Runs against an ephemeral
 * mounted sandbox (no runId passed), since purge happens on delete when no run sandbox is live.
 */
export async function purgeAutomationsMemory(projectId: string, automationIds: string[]): Promise<void> {
    if (automationIds.length === 0) return
    try {
        const fs = await getSandboxProvider().getProjectVolumeFs(projectId)
        try {
            for (const automationId of automationIds) {
                await fs.remove(automationId)
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

/** Delete a project's entire memory, both production and `terse test` volumes. Best-effort. */
export async function purgeProjectMemory(projectId: string): Promise<void> {
    try {
        await getSandboxProvider().deleteProjectVolume(projectId)
        logger.info("memory: deleted project volume", { projectId })
    } catch (error) {
        logger.warn("memory: delete project volume failed, continuing", { projectId, error })
    }
    try {
        await getSandboxProvider().deleteTestProjectVolume(projectId)
        logger.info("memory: deleted test project volume", { projectId })
    } catch (error) {
        logger.warn("memory: delete test project volume failed, continuing", { projectId, error })
    }
}
