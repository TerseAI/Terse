import { SandboxVolume } from "../sandboxProvider/SandboxService"

import { VolumeFs } from "./types"

export interface VolumeManager {
    getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume>
    deleteProjectVolume(projectId: string): Promise<void>
    openProjectVolumeFs(projectId: string, runId?: string): Promise<VolumeFs>
}
