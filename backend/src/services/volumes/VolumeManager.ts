import { SandboxVolume } from "../sandboxProvider/SandboxService"

import { VolumeFs } from "./types"

export interface VolumeManager<V = SandboxVolume> {
    getOrCreateProjectVolume(projectId: string): Promise<V>
    deleteProjectVolume(projectId: string): Promise<void>
    openProjectVolumeFs(projectId: string, runId?: string): Promise<VolumeFs>
}
