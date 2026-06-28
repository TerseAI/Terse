import { settings } from "../../settings"

import { LocalVolumeManager } from "./LocalVolumeManager"
import { PostgresVolumeManager } from "./PostgresVolumeManager"
import { VolumeManager } from "./VolumeManager"

/** Memory + state store: Postgres in the cloud, local disk for self-host. */
export class VolumeManagerProvider {
    private static instance: VolumeManager
    private constructor() {}

    public static getInstance(): VolumeManager {
        if (!VolumeManagerProvider.instance) {
            VolumeManagerProvider.instance = settings.modal ? new PostgresVolumeManager() : new LocalVolumeManager()
        }
        return VolumeManagerProvider.instance
    }
}

export type { VolumeManager } from "./VolumeManager"
export type { VolumeFs, VolumeDirEntry } from "./types"
