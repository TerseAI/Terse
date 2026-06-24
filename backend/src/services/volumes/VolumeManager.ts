import { SandboxVolume } from "../sandboxProvider/SandboxService"

import { VolumeFs } from "./types"

/**
 * Manages a project's persistent memory volume. One implementation per sandbox provider (Modal / local
 * disk); each decides internally how to reach the volume — `openProjectVolumeFs` attaches to a live runner
 * sandbox when `runId` names one (production runs), otherwise reaches the volume headlessly (test runs,
 * `terse memory`, purges). The volume itself is durable in every case.
 */
export interface VolumeManager {
    getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume>
    deleteProjectVolume(projectId: string): Promise<void>
    openProjectVolumeFs(projectId: string, runId?: string): Promise<VolumeFs>
}
