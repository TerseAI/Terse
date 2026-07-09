import { SdkStateKeyEntry } from "terse-types/types"

import { stateSubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { VolumeFs, VolumeManagerProvider } from "../../../services/volumes"

export async function resetJobTestState(projectId: string, automationId: string): Promise<number> {
    const subtreeKey = stateSubtreeKey(automationId, true)
    const fs = await VolumeManagerProvider.getInstance().openProjectVolumeFs(projectId)
    try {
        const keys = await listStateKeys(fs, subtreeKey)
        if (keys.length === 0) return 0
        await fs.remove(subtreeKey)
        await fs.sync()
        return keys.length
    } finally {
        await fs.dispose().catch(() => {})
    }
}

export async function listStateKeys(fs: VolumeFs, subtreeKey: string): Promise<SdkStateKeyEntry[]> {
    let entries: Awaited<ReturnType<VolumeFs["list"]>>
    try {
        entries = await fs.list(subtreeKey)
    } catch {
        return []
    }
    return entries
        .filter(entry => !entry.isDirectory && entry.name.endsWith(".json"))
        .map(entry => ({ key: entry.name.slice(0, -".json".length), sizeBytes: entry.sizeBytes }))
        .sort((a, b) => a.key.localeCompare(b.key))
}
