import { settings } from "../../settings"
import { getSandboxProvider } from "../sandboxProvider"
import { ModalSandboxService } from "../sandboxProvider/ModalSandboxService"

import { LocalVolumeManager } from "./LocalVolumeManager"
import { ModalVolumeManager } from "./ModalVolumeManager"
import { VolumeManager } from "./VolumeManager"

let volumeManagerSingleton: VolumeManager | null = null

/** The volume manager for the active sandbox provider (Modal in cloud, local disk for self-host). */
export function getVolumeManager(): VolumeManager {
    if (!volumeManagerSingleton) {
        volumeManagerSingleton = settings.modal ? new ModalVolumeManager(getSandboxProvider() as ModalSandboxService) : new LocalVolumeManager()
    }
    return volumeManagerSingleton
}

export { VolumeManager } from "./VolumeManager"
export { VolumeFs, VolumeDirEntry } from "./types"
